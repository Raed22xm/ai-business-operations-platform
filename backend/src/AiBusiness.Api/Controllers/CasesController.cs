using AiBusiness.Api.Data;
using AiBusiness.Api.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AiBusiness.Api.Controllers;

[ApiController]
[Route("api/cases")]
public class CasesController : ControllerBase
{
    private const int MaximumTitleLength = 200;
    private readonly AppDbContext _database;

    public CasesController(AppDbContext database)
    {
        _database = database;
    }

    [HttpGet]
    [EndpointSummary("List cases")]
    [EndpointDescription(
        "Without `page` or `pageSize`, returns a JSON array of cases ordered newest `createdAt` first, then highest `id`. "
            + "When `page` and/or `pageSize` is present, returns `{ items, page, pageSize, totalCount }` "
            + "(defaults page=1, pageSize=20, max pageSize=100). "
            + "Optional filters: `customerId`, `status` (Open|InProgress|Closed, case-sensitive), "
            + "`search` (title or description, case-insensitive). Filters combine and apply before count/slice.")]
    [ProducesResponseType(typeof(Case[]), StatusCodes.Status200OK, Description = "Unpaginated case array when page and pageSize are omitted.")]
    [ProducesResponseType(typeof(PagedResult<Case>), StatusCodes.Status200OK, Description = "Paginated cases when page and/or pageSize is provided.")]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest, Description = "Invalid status, page, or pageSize.")]
    public async Task<IActionResult> GetAll(
        [FromQuery] int? customerId = null,
        [FromQuery] string? status = null,
        [FromQuery] string? search = null,
        [FromQuery] int? page = null,
        [FromQuery] int? pageSize = null)
    {
        if (!Pagination.TryResolve(
                page,
                pageSize,
                ModelState,
                out var resolvedPage,
                out var resolvedPageSize,
                out var paginate))
        {
            return ValidationProblem(ModelState);
        }

        CaseStatus? statusFilter = null;
        if (!string.IsNullOrWhiteSpace(status))
        {
            if (!TryReadStatus(status.Trim(), out var parsed))
            {
                ModelState.AddModelError(nameof(status), "Status must be Open, InProgress, or Closed.");
                return ValidationProblem(ModelState);
            }

            statusFilter = parsed;
        }

        var query = _database.Cases.AsQueryable();
        if (customerId is int id)
        {
            query = query.Where(work => work.CustomerId == id);
        }

        if (statusFilter is CaseStatus selectedStatus)
        {
            query = query.Where(work => work.Status == selectedStatus);
        }

        var term = search?.Trim();
        if (!string.IsNullOrEmpty(term))
        {
            var needle = term.ToLower();
            query = query.Where(work =>
                work.Title.ToLower().Contains(needle)
                || (work.Description != null && work.Description.ToLower().Contains(needle)));
        }

        query = query
            .OrderByDescending(work => work.CreatedAt)
            .ThenByDescending(work => work.Id);

        if (!paginate)
        {
            return Ok(await query.ToArrayAsync());
        }

        return Ok(await Pagination.ToPageAsync(query, resolvedPage, resolvedPageSize));
    }

    [HttpGet("{id:int}")]
    [EndpointSummary("Get case by id")]
    [EndpointDescription("Returns one case, or 404 if it does not exist.")]
    [ProducesResponseType(typeof(Case), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetById(int id)
    {
        var work = await _database.Cases.FindAsync(id);
        if (work is null)
        {
            return NotFound();
        }

        return Ok(work);
    }

    [HttpPost]
    [EndpointSummary("Create case")]
    [EndpointDescription(
        "Creates a case for an existing customer. Required: `customerId`, `title` (1–200 chars). "
            + "Optional: `description`. Server sets `id`, UTC `createdAt`, and always stores status `Open` "
            + "(client `status`/`id`/`createdAt` ignored). Returns 201 with a Location header.")]
    [ProducesResponseType(typeof(Case), StatusCodes.Status201Created, Description = "Case created as Open. Location header points at the new resource.")]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest, Description = "Invalid title, missing customer, or unknown customerId.")]
    public async Task<IActionResult> Create(Case work)
    {
        await ValidateForCreate(work);
        if (!ModelState.IsValid)
        {
            return ValidationProblem(ModelState);
        }

        work.Id = 0;
        work.Status = CaseStatus.Open;
        _database.Cases.Add(work);
        await _database.SaveChangesAsync();

        return CreatedAtAction(nameof(GetById), new { id = work.Id }, work);
    }

    [HttpPut("{id:int}")]
    [EndpointSummary("Update case")]
    [EndpointDescription(
        "Updates `title`, `description`, and `status` only. "
            + "`id`, `customerId`, and `createdAt` cannot change (body values ignored). "
            + "`status` must be exactly Open, InProgress, or Closed.")]
    [ProducesResponseType(typeof(Case), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Update(int id, CaseUpdate changes)
    {
        var titleIsValid = TryReadTitle(changes.Title, out var title);
        var statusIsValid = TryReadStatus(changes.Status, out var status);
        if (!titleIsValid)
        {
            AddTitleError(changes.Title);
        }

        if (!statusIsValid)
        {
            ModelState.AddModelError(nameof(changes.Status), "Status must be Open, InProgress, or Closed.");
        }

        if (!ModelState.IsValid)
        {
            return ValidationProblem(ModelState);
        }

        var existing = await _database.Cases.FindAsync(id);
        if (existing is null)
        {
            return NotFound();
        }

        existing.Title = title;
        existing.Description = NormalizeDescription(changes.Description);
        existing.Status = status;
        await _database.SaveChangesAsync();

        return Ok(existing);
    }

    [HttpDelete("{id:int}")]
    [EndpointSummary("Delete case")]
    [EndpointDescription("Deletes the case. Leaves the customer and other cases unchanged.")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(int id)
    {
        var existing = await _database.Cases.FindAsync(id);
        if (existing is null)
        {
            return NotFound();
        }

        _database.Cases.Remove(existing);
        await _database.SaveChangesAsync();

        return NoContent();
    }

    private async Task ValidateForCreate(Case work)
    {
        if (TryReadTitle(work.Title, out var title))
        {
            work.Title = title;
        }
        else
        {
            AddTitleError(work.Title);
        }

        work.Description = NormalizeDescription(work.Description);

        if (work.CustomerId <= 0)
        {
            ModelState.AddModelError(nameof(work.CustomerId), "Customer is required.");
            return;
        }

        var customerExists = await _database.Customers
            .AnyAsync(customer => customer.Id == work.CustomerId);
        if (!customerExists)
        {
            ModelState.AddModelError(nameof(work.CustomerId), "Customer was not found.");
        }
    }

    private bool TryReadTitle(string? value, out string title)
    {
        title = value?.Trim() ?? "";
        return title.Length > 0 && title.Length <= MaximumTitleLength;
    }

    private void AddTitleError(string? value)
    {
        var title = value?.Trim() ?? "";
        var message = title.Length == 0
            ? "Title is required."
            : "Title must be at most 200 characters.";
        ModelState.AddModelError(nameof(Case.Title), message);
    }

    private static string? NormalizeDescription(string? value)
    {
        var description = value?.Trim();
        return string.IsNullOrEmpty(description) ? null : description;
    }

    private static bool TryReadStatus(string? value, out CaseStatus status)
    {
        if (Enum.TryParse(value, ignoreCase: false, out status)
            && Enum.IsDefined(status)
            && status.ToString() == value)
        {
            return true;
        }

        status = default;
        return false;
    }
}
