using System.Security.Claims;
using AiBusiness.Api.Controllers;
using AiBusiness.Api.Data;
using AiBusiness.Api.Models;
using AiBusiness.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;

namespace AiBusiness.Api.Tests;

public sealed class InquiriesControllerTests : IDisposable
{
    private readonly SqliteConnection _connection;
    private readonly AppDbContext _database;
    private readonly CaseActivityWriter _activity;

    public InquiriesControllerTests()
    {
        _connection = new SqliteConnection("Data Source=:memory:");
        _connection.Open();
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseSqlite(_connection)
            .Options;
        _database = new AppDbContext(options);
        _database.Database.EnsureCreated();
        _activity = new CaseActivityWriter(_database);
    }

    public void Dispose()
    {
        _database.Dispose();
        _connection.Dispose();
    }

    private InquiriesController CreateController(string actorName = "Operator Alex")
    {
        var controller = new InquiriesController(_database, _activity);
        var identity = new ClaimsIdentity(
            new[] { new Claim(ClaimTypes.Name, actorName) },
            "TestAuth");
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext
            {
                User = new ClaimsPrincipal(identity),
            },
        };
        return controller;
    }

    [Fact]
    public async Task ResolveCustomer_EmptyEmail_ReturnsValidationProblem()
    {
        var controller = CreateController();

        var result = await controller.ResolveCustomer("   ", CancellationToken.None);

        var objectResult = Assert.IsAssignableFrom<ObjectResult>(result);
        var problem = Assert.IsType<ValidationProblemDetails>(objectResult.Value);
        Assert.True(problem.Errors.ContainsKey("email"));
    }

    [Fact]
    public async Task ResolveCustomer_NoMatches_ReturnsEmptyMatches()
    {
        var controller = CreateController();

        var result = await controller.ResolveCustomer("unknown@example.com", CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result);
        var response = Assert.IsType<ResolveCustomerResponse>(ok.Value);
        Assert.Empty(response.Matches);
        Assert.False(response.HasExactMatch);
    }

    [Fact]
    public async Task ResolveCustomer_SingleMatch_ReturnsMatchCaseInsensitively()
    {
        _database.Customers.Add(new Customer
        {
            Name = "John Doe",
            Email = "john.doe@example.com",
            Company = "Acme Corp",
            Phone = "12345678",
            CreatedAt = DateTime.UtcNow,
        });
        await _database.SaveChangesAsync();

        var controller = CreateController();

        var result = await controller.ResolveCustomer("  JOHN.DOE@EXAMPLE.COM  ", CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result);
        var response = Assert.IsType<ResolveCustomerResponse>(ok.Value);
        Assert.Single(response.Matches);
        Assert.True(response.HasExactMatch);
        Assert.False(response.HasMultipleMatches);
        Assert.Equal("John Doe", response.Matches[0].Name);
        Assert.Equal("Acme Corp", response.Matches[0].Company);
    }

    [Fact]
    public async Task ResolveCustomer_MultipleMatches_ReturnsAllMatches()
    {
        _database.Customers.AddRange(
            new Customer { Name = "First Match", Email = "shared@example.com", CreatedAt = DateTime.UtcNow },
            new Customer { Name = "Second Match", Email = "shared@example.com", CreatedAt = DateTime.UtcNow });
        await _database.SaveChangesAsync();

        var controller = CreateController();

        var result = await controller.ResolveCustomer("shared@example.com", CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result);
        var response = Assert.IsType<ResolveCustomerResponse>(ok.Value);
        Assert.Equal(2, response.Matches.Count);
        Assert.True(response.HasMultipleMatches);
    }

    [Theory]
    [InlineData("", "valid@example.com", "Title", "Customer name is required.")]
    [InlineData("Name", "", "Title", "Customer email is required.")]
    [InlineData("Name", "notanemail", "Title", "Customer email format is invalid.")]
    [InlineData("Name", "valid@example.com", "", "Request title is required.")]
    public async Task Create_InvalidInputs_ReturnsValidationProblem(
        string name,
        string email,
        string title,
        string expectedError)
    {
        var controller = CreateController();

        var result = await controller.Create(new CreateInquiryRequest
        {
            CustomerName = name,
            CustomerEmail = email,
            Title = title,
        }, CancellationToken.None);

        var badRequest = Assert.IsAssignableFrom<ObjectResult>(result);
        var details = Assert.IsType<ValidationProblemDetails>(badRequest.Value);
        Assert.Contains(details.Errors.Values, errors => errors.Any(msg => msg.Contains(expectedError)));
    }

    [Fact]
    public async Task Create_NewCustomer_SavesCustomerAndCaseInTransaction()
    {
        var controller = CreateController("Operator Rachel");

        var result = await controller.Create(new CreateInquiryRequest
        {
            CustomerName = "New Customer",
            CustomerEmail = "new.client@example.com",
            CustomerPhone = "99887766",
            CustomerCompany = "Startup Inc",
            Title = "Initial website consultation",
            Description = "Looking for an appointment next week.",
        }, CancellationToken.None);

        var created = Assert.IsType<CreatedAtActionResult>(result);
        var response = Assert.IsType<CreateInquiryResponse>(created.Value);

        Assert.True(response.IsNewCustomer);
        Assert.True(response.CustomerId > 0);
        Assert.True(response.CaseId > 0);
        Assert.Equal("New Customer", response.CustomerName);
        Assert.Equal("Initial website consultation", response.CaseTitle);

        // Verify database persistence
        var savedCustomer = await _database.Customers.FindAsync(response.CustomerId);
        Assert.NotNull(savedCustomer);
        Assert.Equal("new.client@example.com", savedCustomer.Email);
        Assert.Equal("Startup Inc", savedCustomer.Company);

        var savedCase = await _database.Cases.FindAsync(response.CaseId);
        Assert.NotNull(savedCase);
        Assert.Equal(CaseStatus.Open, savedCase.Status);
        Assert.Equal(savedCustomer.Id, savedCase.CustomerId);

        // Verify activity history logged
        var activities = await _database.CaseActivities
            .Where(a => a.CaseId == response.CaseId)
            .ToListAsync();
        Assert.Single(activities);
        Assert.Equal(CaseActivityEventType.CaseCreated, activities[0].EventType);
        Assert.Equal("Operator Rachel", activities[0].ActorName);
    }

    [Fact]
    public async Task Create_ExistingCustomerSelected_LinksCaseWithoutMutatingCustomer()
    {
        var existingCustomer = new Customer
        {
            Name = "Original Name",
            Email = "original@example.com",
            Company = "Original Company",
            Phone = "11111111",
            CreatedAt = DateTime.UtcNow,
        };
        _database.Customers.Add(existingCustomer);
        await _database.SaveChangesAsync();

        var controller = CreateController();

        var result = await controller.Create(new CreateInquiryRequest
        {
            SelectedCustomerId = existingCustomer.Id,
            CustomerName = "Different Name Attempt",
            CustomerEmail = "different@example.com",
            Title = "Follow-up service ticket",
        }, CancellationToken.None);

        var created = Assert.IsType<CreatedAtActionResult>(result);
        var response = Assert.IsType<CreateInquiryResponse>(created.Value);

        Assert.False(response.IsNewCustomer);
        Assert.Equal(existingCustomer.Id, response.CustomerId);

        // Customer details were NOT overwritten
        var fresh = await _database.Customers.AsNoTracking().SingleAsync(c => c.Id == existingCustomer.Id);
        Assert.Equal("Original Name", fresh.Name);
        Assert.Equal("original@example.com", fresh.Email);
        Assert.Equal("Original Company", fresh.Company);

        // Case was linked to existing customer
        var work = await _database.Cases.FindAsync(response.CaseId);
        Assert.NotNull(work);
        Assert.Equal(existingCustomer.Id, work.CustomerId);
    }

    [Fact]
    public async Task Create_MatchesExistWithoutConfirmation_ReturnsConflict()
    {
        _database.Customers.Add(new Customer
        {
            Name = "Existing Match",
            Email = "match@example.com",
            CreatedAt = DateTime.UtcNow,
        });
        await _database.SaveChangesAsync();

        var controller = CreateController();

        var result = await controller.Create(new CreateInquiryRequest
        {
            CustomerName = "New Submitter",
            CustomerEmail = "match@example.com",
            Title = "New request",
            ConfirmCreateNew = false,
        }, CancellationToken.None);

        var conflict = Assert.IsAssignableFrom<ObjectResult>(result);
        Assert.Equal(StatusCodes.Status409Conflict, conflict.StatusCode);
        var problem = Assert.IsType<ProblemDetails>(conflict.Value);
        Assert.Equal("Customer match required", problem.Title);
        Assert.True(problem.Extensions.ContainsKey("matches"));
    }

    [Fact]
    public async Task Create_MatchesExistWithExplicitConfirm_CreatesNewCustomer()
    {
        _database.Customers.Add(new Customer
        {
            Name = "Existing Match",
            Email = "match@example.com",
            CreatedAt = DateTime.UtcNow,
        });
        await _database.SaveChangesAsync();

        var controller = CreateController();

        var result = await controller.Create(new CreateInquiryRequest
        {
            CustomerName = "Second Customer Same Email",
            CustomerEmail = "match@example.com",
            Title = "Separate inquiry",
            ConfirmCreateNew = true,
        }, CancellationToken.None);

        var created = Assert.IsType<CreatedAtActionResult>(result);
        var response = Assert.IsType<CreateInquiryResponse>(created.Value);
        Assert.True(response.IsNewCustomer);

        var count = await _database.Customers.CountAsync(c => c.Email == "match@example.com");
        Assert.Equal(2, count);
    }

    [Fact]
    public async Task Create_DuplicateSubmission_ReturnsConflict()
    {
        var customer = new Customer
        {
            Name = "Loyal Client",
            Email = "loyal@example.com",
            CreatedAt = DateTime.UtcNow,
        };
        _database.Customers.Add(customer);
        await _database.SaveChangesAsync();

        var controller = CreateController();

        // First submission succeeds
        var firstResult = await controller.Create(new CreateInquiryRequest
        {
            SelectedCustomerId = customer.Id,
            Title = "Weekly Maintenance",
        }, CancellationToken.None);
        Assert.IsType<CreatedAtActionResult>(firstResult);

        // Immediate retry of identical submission returns 409 Conflict
        var secondResult = await controller.Create(new CreateInquiryRequest
        {
            SelectedCustomerId = customer.Id,
            Title = "Weekly Maintenance",
        }, CancellationToken.None);

        var conflict = Assert.IsAssignableFrom<ObjectResult>(secondResult);
        Assert.Equal(StatusCodes.Status409Conflict, conflict.StatusCode);
        var problem = Assert.IsType<ProblemDetails>(conflict.Value);
        Assert.Equal("Duplicate inquiry", problem.Title);
    }

    [Fact]
    public void Controller_RequiresAuthorization()
    {
        var authorizeAttribute = typeof(InquiriesController)
            .GetCustomAttributes(typeof(AuthorizeAttribute), inherit: true);
        Assert.NotEmpty(authorizeAttribute);
    }

    [Fact]
    public async Task Create_SelectedCustomerNotFound_ReturnsValidationProblem()
    {
        var controller = CreateController();

        var result = await controller.Create(new CreateInquiryRequest
        {
            SelectedCustomerId = 999999,
            Title = "Valid Title",
        }, CancellationToken.None);

        var badRequest = Assert.IsAssignableFrom<ObjectResult>(result);
        var details = Assert.IsType<ValidationProblemDetails>(badRequest.Value);
        Assert.True(details.Errors.ContainsKey(nameof(CreateInquiryRequest.SelectedCustomerId)));
    }
}
