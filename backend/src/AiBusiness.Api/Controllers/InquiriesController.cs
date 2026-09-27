using System.ComponentModel.DataAnnotations;
using AiBusiness.Api.Data;
using AiBusiness.Api.Models;
using AiBusiness.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AiBusiness.Api.Controllers;

[ApiController]
[Route("api/inquiries")]
[Authorize]
public class InquiriesController : ControllerBase
{
    private readonly AppDbContext _database;
    private readonly CaseActivityWriter _activity;

    public InquiriesController(AppDbContext database, CaseActivityWriter activity)
    {
        _database = database;
        _activity = activity;
    }

    [HttpGet("resolve-customer")]
    [EndpointSummary("Resolve customer by email")]
    [EndpointDescription("Searches for existing customers by trimmed, case-insensitive email without mutating data.")]
    [ProducesResponseType(typeof(ResolveCustomerResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> ResolveCustomer([FromQuery] string? email, CancellationToken cancellationToken)
    {
        var trimmed = email?.Trim() ?? string.Empty;
        if (string.IsNullOrWhiteSpace(trimmed))
        {
            ModelState.AddModelError(nameof(email), "Email is required to resolve a customer.");
            return ValidationProblem(ModelState);
        }

        var normalized = trimmed.ToLowerInvariant();
        var matches = await _database.Customers
            .AsNoTracking()
            .Where(c => c.Email.ToLower() == normalized)
            .OrderBy(c => c.Id)
            .Select(c => CustomerMatchDto.From(c))
            .ToListAsync(cancellationToken);

        return Ok(new ResolveCustomerResponse
        {
            QueryEmail = trimmed,
            Matches = matches,
        });
    }

    [HttpPost]
    [EndpointSummary("Create inquiry as customer and case")]
    [EndpointDescription(
        "Atomically turns an inquiry into a Customer and an Open Case in a single transaction. " +
        "Reuses existing customers when matched/confirmed, avoids duplicate submissions, and logs CaseCreated activity.")]
    [ProducesResponseType(typeof(CreateInquiryResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Create(CreateInquiryRequest request, CancellationToken cancellationToken)
    {
        ValidateInquiry(request);
        if (!ModelState.IsValid)
        {
            return ValidationProblem(ModelState);
        }

        Customer customer;
        var isNewCustomer = false;

        // 1. Resolve or validate the customer
        if (request.SelectedCustomerId.HasValue)
        {
            var existing = await _database.Customers.FindAsync(
                new object[] { request.SelectedCustomerId.Value },
                cancellationToken);

            if (existing is null)
            {
                ModelState.AddModelError(nameof(request.SelectedCustomerId), "The selected customer does not exist.");
                return ValidationProblem(ModelState);
            }

            customer = existing;
        }
        else
        {
            var normalizedEmail = request.CustomerEmail!.Trim().ToLowerInvariant();
            var matches = await _database.Customers
                .Where(c => c.Email.ToLower() == normalizedEmail)
                .OrderBy(c => c.Id)
                .ToListAsync(cancellationToken);

            if (matches.Count > 0 && !request.ConfirmCreateNew)
            {
                return Conflict(new ProblemDetails
                {
                    Title = "Customer match required",
                    Detail = matches.Count == 1
                        ? $"An existing customer ({matches[0].Name}) matches this email. Please confirm or select."
                        : $"Multiple existing customers match this email ({matches.Count} found). Please select an existing customer.",
                    Status = StatusCodes.Status409Conflict,
                    Extensions =
                    {
                        ["matches"] = matches.Select(CustomerMatchDto.From).ToList(),
                        ["code"] = "CustomerMatchRequired",
                    },
                });
            }

            customer = new Customer
            {
                Name = request.CustomerName!.Trim(),
                Email = request.CustomerEmail!.Trim(),
                Phone = string.IsNullOrWhiteSpace(request.CustomerPhone) ? null : request.CustomerPhone.Trim(),
                Company = string.IsNullOrWhiteSpace(request.CustomerCompany) ? null : request.CustomerCompany.Trim(),
                CreatedAt = UtcNow(),
            };
            isNewCustomer = true;
        }

        // 2. Prevent duplicate cases from repeated submissions / retries
        var titleTrimmed = request.Title.Trim();
        var recentCutoff = UtcNow().AddMinutes(-2);

        // Check against existing cases for this customer (if customer is existing)
        if (!isNewCustomer)
        {
            var duplicate = await _database.Cases
                .AnyAsync(
                    c => c.CustomerId == customer.Id
                        && c.Title.ToLower() == titleTrimmed.ToLower()
                        && c.CreatedAt >= recentCutoff,
                    cancellationToken);

            if (duplicate)
            {
                return Conflict(new ProblemDetails
                {
                    Title = "Duplicate inquiry",
                    Detail = "An identical case for this customer was submitted in the last two minutes.",
                    Status = StatusCodes.Status409Conflict,
                    Extensions = { ["code"] = "DuplicateInquiry" },
                });
            }
        }

        // 3. Atomically persist in one transaction
        await using var transaction = await _database.Database.BeginTransactionAsync(cancellationToken);
        try
        {
            if (isNewCustomer)
            {
                _database.Customers.Add(customer);
                await _database.SaveChangesAsync(cancellationToken);
            }

            var work = new Case
            {
                CustomerId = customer.Id,
                Title = titleTrimmed,
                Description = string.IsNullOrWhiteSpace(request.Description) ? null : request.Description.Trim(),
                Status = CaseStatus.Open,
                CreatedAt = UtcNow(),
            };
            _database.Cases.Add(work);
            await _database.SaveChangesAsync(cancellationToken);

            var actor = User.Identity?.Name ?? "Inquiry Intake";
            _activity.Record(
                work.Id,
                CaseActivityEventType.CaseCreated,
                $"Inquiry intake: {work.Title} for {customer.Name}",
                actor);
            await _database.SaveChangesAsync(cancellationToken);

            await transaction.CommitAsync(cancellationToken);

            var response = new CreateInquiryResponse
            {
                CaseId = work.Id,
                CustomerId = customer.Id,
                CustomerName = customer.Name,
                CaseTitle = work.Title,
                IsNewCustomer = isNewCustomer,
                CreatedAt = work.CreatedAt,
            };

            return CreatedAtAction(
                nameof(CasesController.GetById),
                "Cases",
                new { id = work.Id },
                response);
        }
        catch
        {
            await transaction.RollbackAsync(cancellationToken);
            throw;
        }
    }

    private void ValidateInquiry(CreateInquiryRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Title))
        {
            ModelState.AddModelError(nameof(request.Title), "Request title is required.");
        }
        else if (request.Title.Trim().Length > 200)
        {
            ModelState.AddModelError(nameof(request.Title), "Request title cannot exceed 200 characters.");
        }

        if (request.SelectedCustomerId.HasValue)
        {
            if (request.SelectedCustomerId.Value <= 0)
            {
                ModelState.AddModelError(nameof(request.SelectedCustomerId), "Selected customer ID is invalid.");
            }
            return;
        }

        if (string.IsNullOrWhiteSpace(request.CustomerName))
        {
            ModelState.AddModelError(nameof(request.CustomerName), "Customer name is required.");
        }
        else if (request.CustomerName.Trim().Length > 100)
        {
            ModelState.AddModelError(nameof(request.CustomerName), "Customer name cannot exceed 100 characters.");
        }

        if (string.IsNullOrWhiteSpace(request.CustomerEmail))
        {
            ModelState.AddModelError(nameof(request.CustomerEmail), "Customer email is required.");
        }
        else if (!new EmailAddressAttribute().IsValid(request.CustomerEmail.Trim()))
        {
            ModelState.AddModelError(nameof(request.CustomerEmail), "Customer email format is invalid.");
        }

        if (!string.IsNullOrWhiteSpace(request.CustomerPhone) && request.CustomerPhone.Trim().Length > 50)
        {
            ModelState.AddModelError(nameof(request.CustomerPhone), "Customer phone cannot exceed 50 characters.");
        }

        if (!string.IsNullOrWhiteSpace(request.CustomerCompany) && request.CustomerCompany.Trim().Length > 100)
        {
            ModelState.AddModelError(nameof(request.CustomerCompany), "Customer company cannot exceed 100 characters.");
        }
    }

    private static DateTime UtcNow()
    {
        var now = DateTime.UtcNow;
        var ticks = now.Ticks - (now.Ticks % TimeSpan.TicksPerMicrosecond);
        return new DateTime(ticks, DateTimeKind.Utc);
    }
}
