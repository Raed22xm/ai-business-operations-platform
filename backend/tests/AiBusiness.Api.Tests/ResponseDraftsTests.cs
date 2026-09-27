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

public class ResponseDraftsTests : IDisposable
{
    private readonly SqliteConnection _connection;
    private readonly AppDbContext _database;
    private readonly CaseActivityWriter _activity;
    private readonly CaseAssistantService _assistant;

    public ResponseDraftsTests()
    {
        _connection = new SqliteConnection("Data Source=:memory:");
        _connection.Open();
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseSqlite(_connection)
            .Options;
        _database = new AppDbContext(options);
        _database.Database.EnsureCreated();

        _activity = new CaseActivityWriter(_database);
        _assistant = new CaseAssistantService(
            _database,
            new MockOpenAiClient("mock-model"));
    }

    public void Dispose()
    {
        _database.Dispose();
        _connection.Dispose();
    }

    private ResponseDraftsController CreateController(string actorName = "Operator Sarah")
    {
        var controller = new ResponseDraftsController(_database, _activity, _assistant);
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

    private async Task<Case> AddCase(bool archived = false)
    {
        var customer = new Customer
        {
            Name = "Test Customer",
            Email = "customer@example.com",
            CreatedAt = DateTime.UtcNow,
        };
        _database.Customers.Add(customer);
        await _database.SaveChangesAsync();

        var work = new Case
        {
            CustomerId = customer.Id,
            Title = "Network Connectivity Investigation",
            Description = "Customer reports intermittency on secondary switch.",
            Status = CaseStatus.Open,
            CreatedAt = DateTime.UtcNow,
        };
        _database.Cases.Add(work);
        await _database.SaveChangesAsync();

        if (archived)
        {
            work.ArchivedAt = DateTime.UtcNow;
            await _database.SaveChangesAsync();
        }
        return work;
    }

    [Fact]
    public void Controller_RequiresAuthorization()
    {
        var authAttributes = typeof(ResponseDraftsController)
            .GetCustomAttributes(typeof(AuthorizeAttribute), inherit: true);
        Assert.NotEmpty(authAttributes);
    }

    [Fact]
    public async Task GetAll_CaseNotFound_ReturnsNotFound()
    {
        var controller = CreateController();
        var result = await controller.GetAll(9999, CancellationToken.None);
        Assert.IsType<NotFoundResult>(result);
    }

    [Fact]
    public async Task GetAll_ReturnsDraftsNewestFirst()
    {
        var work = await AddCase();
        var controller = CreateController();

        var first = await controller.Create(work.Id, new CreateResponseDraftRequest
        {
            Content = "First draft content",
            Source = ResponseDraftSource.Manual,
        }, CancellationToken.None);

        var second = await controller.Create(work.Id, new CreateResponseDraftRequest
        {
            Content = "Second draft content",
            Source = ResponseDraftSource.Ai,
        }, CancellationToken.None);

        var result = await controller.GetAll(work.Id, CancellationToken.None);
        var ok = Assert.IsType<OkObjectResult>(result);
        var drafts = Assert.IsAssignableFrom<IEnumerable<ResponseDraft>>(ok.Value).ToList();

        Assert.Equal(2, drafts.Count);
        Assert.Equal("Second draft content", drafts[0].Content);
        Assert.Equal("First draft content", drafts[1].Content);
    }

    [Fact]
    public async Task Create_ArchivedCase_ReturnsConflict()
    {
        var work = await AddCase(archived: true);
        var controller = CreateController();

        var result = await controller.Create(work.Id, new CreateResponseDraftRequest
        {
            Content = "Cannot draft for archived case",
        }, CancellationToken.None);

        var conflict = Assert.IsAssignableFrom<ObjectResult>(result);
        Assert.Equal(StatusCodes.Status409Conflict, conflict.StatusCode);
    }

    [Fact]
    public async Task Create_ValidDraft_SetsCreatorTimestampsAndVersion()
    {
        var work = await AddCase();
        var controller = CreateController("Operator Rachel");

        var result = await controller.Create(work.Id, new CreateResponseDraftRequest
        {
            Content = "Hello, here is a response regarding your inquiry.",
            Source = ResponseDraftSource.Ai,
        }, CancellationToken.None);

        var created = Assert.IsType<CreatedAtActionResult>(result);
        var draft = Assert.IsType<ResponseDraft>(created.Value);

        Assert.True(draft.Id > 0);
        Assert.Equal(work.Id, draft.CaseId);
        Assert.Equal("Hello, here is a response regarding your inquiry.", draft.Content);
        Assert.Equal(ResponseDraftSource.Ai, draft.Source);
        Assert.Equal(ResponseDraftStatus.Draft, draft.Status);
        Assert.Equal("Operator Rachel", draft.CreatedBy);
        Assert.Null(draft.ApprovedBy);
        Assert.Null(draft.ApprovedAt);
        Assert.Equal(1, draft.Version);

        // Verify activity history logged without leaking draft text
        var activities = await _database.CaseActivities.Where(a => a.CaseId == work.Id).ToListAsync();
        Assert.Single(activities);
        Assert.Equal(CaseActivityEventType.DraftCreated, activities[0].EventType);
        Assert.DoesNotContain("Hello, here is a response", activities[0].Description);
        Assert.Contains("Response draft created", activities[0].Description);
    }

    [Fact]
    public async Task Create_InvalidContent_ReturnsValidationProblem()
    {
        var work = await AddCase();
        var controller = CreateController();

        var result = await controller.Create(work.Id, new CreateResponseDraftRequest
        {
            Content = "   ",
        }, CancellationToken.None);

        var badRequest = Assert.IsAssignableFrom<ObjectResult>(result);
        var details = Assert.IsType<ValidationProblemDetails>(badRequest.Value);
        Assert.True(details.Errors.ContainsKey(nameof(CreateResponseDraftRequest.Content)));
    }

    [Fact]
    public async Task Update_StaleVersion_ReturnsConflict()
    {
        var work = await AddCase();
        var controller = CreateController();

        var createResult = await controller.Create(work.Id, new CreateResponseDraftRequest
        {
            Content = "Initial content",
        }, CancellationToken.None);
        var draft = Assert.IsType<ResponseDraft>(((CreatedAtActionResult)createResult).Value);

        // First update succeeds and increments version to 2
        var firstUpdate = await controller.Update(work.Id, draft.Id, new UpdateResponseDraftRequest
        {
            Content = "Updated content v2",
            ExpectedVersion = 1,
        }, CancellationToken.None);
        Assert.IsType<OkObjectResult>(firstUpdate);

        // Stale update from another tab sending ExpectedVersion = 1 fails with 409 Conflict
        var staleUpdate = await controller.Update(work.Id, draft.Id, new UpdateResponseDraftRequest
        {
            Content = "Conflicting overwrite attempt",
            ExpectedVersion = 1,
        }, CancellationToken.None);

        var conflict = Assert.IsAssignableFrom<ObjectResult>(staleUpdate);
        Assert.Equal(StatusCodes.Status409Conflict, conflict.StatusCode);
        var problem = Assert.IsType<ProblemDetails>(conflict.Value);
        Assert.Equal("Conflicting update", problem.Title);
    }

    [Fact]
    public async Task Update_ApprovedDraft_RevertsToDraftAndClearsApproval()
    {
        var work = await AddCase();
        var controller = CreateController("Operator Alice");

        var createResult = await controller.Create(work.Id, new CreateResponseDraftRequest
        {
            Content = "Initial message for client",
        }, CancellationToken.None);
        var draft = Assert.IsType<ResponseDraft>(((CreatedAtActionResult)createResult).Value);

        // Approve it
        var approveResult = await controller.Approve(work.Id, draft.Id, new ApproveResponseDraftRequest
        {
            ApprovedContent = "Initial message for client",
            ExpectedVersion = 1,
        }, CancellationToken.None);
        var approved = Assert.IsType<ResponseDraft>(((OkObjectResult)approveResult).Value);
        Assert.Equal(ResponseDraftStatus.Approved, approved.Status);
        Assert.Equal("Operator Alice", approved.ApprovedBy);
        Assert.NotNull(approved.ApprovedAt);
        Assert.Equal(2, approved.Version);

        // Edit approved text
        var updateResult = await controller.Update(work.Id, draft.Id, new UpdateResponseDraftRequest
        {
            Content = "Edited message with revised schedule",
            ExpectedVersion = approved.Version,
        }, CancellationToken.None);

        var updated = Assert.IsType<ResponseDraft>(((OkObjectResult)updateResult).Value);
        Assert.Equal("Edited message with revised schedule", updated.Content);
        // Requirement: Editing approved text returns it to Draft and clears its approval
        Assert.Equal(ResponseDraftStatus.Draft, updated.Status);
        Assert.Null(updated.ApprovedBy);
        Assert.Null(updated.ApprovedAt);
        Assert.Equal(3, updated.Version);
    }

    [Fact]
    public async Task Approve_UnsavedContent_ReturnsValidationProblem()
    {
        var work = await AddCase();
        var controller = CreateController();

        var createResult = await controller.Create(work.Id, new CreateResponseDraftRequest
        {
            Content = "Saved text",
        }, CancellationToken.None);
        var draft = Assert.IsType<ResponseDraft>(((CreatedAtActionResult)createResult).Value);

        // Attempting to approve modified unsaved text fails
        var result = await controller.Approve(work.Id, draft.Id, new ApproveResponseDraftRequest
        {
            ApprovedContent = "Unsaved altered text",
            ExpectedVersion = 1,
        }, CancellationToken.None);

        var badRequest = Assert.IsAssignableFrom<ObjectResult>(result);
        var problem = Assert.IsType<ValidationProblemDetails>(badRequest.Value);
        Assert.True(problem.Errors.ContainsKey(nameof(ApproveResponseDraftRequest.ApprovedContent)));
    }

    [Fact]
    public async Task Approve_ExactContent_SetsApprovedAndLogsActivity()
    {
        var work = await AddCase();
        var controller = CreateController("Approver Bob");

        var createResult = await controller.Create(work.Id, new CreateResponseDraftRequest
        {
            Content = "Exact approved wording.",
        }, CancellationToken.None);
        var draft = Assert.IsType<ResponseDraft>(((CreatedAtActionResult)createResult).Value);

        var result = await controller.Approve(work.Id, draft.Id, new ApproveResponseDraftRequest
        {
            ApprovedContent = "Exact approved wording.",
            ExpectedVersion = 1,
        }, CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result);
        var approved = Assert.IsType<ResponseDraft>(ok.Value);

        Assert.Equal(ResponseDraftStatus.Approved, approved.Status);
        Assert.Equal("Approver Bob", approved.ApprovedBy);
        Assert.NotNull(approved.ApprovedAt);

        // Check activity history
        var activities = await _database.CaseActivities
            .Where(a => a.CaseId == work.Id && a.EventType == CaseActivityEventType.DraftApproved)
            .ToListAsync();
        Assert.Single(activities);
        Assert.Contains("approved", activities[0].Description);
        Assert.DoesNotContain("Exact approved wording", activities[0].Description);
    }

    [Fact]
    public async Task GenerateAndSave_CreatesDraftWithAssistantContent()
    {
        var work = await AddCase();
        var controller = CreateController("Operator Rachel");

        var result = await controller.GenerateAndSave(work.Id, CancellationToken.None);
        var created = Assert.IsType<CreatedAtActionResult>(result);
        var draft = Assert.IsType<ResponseDraft>(created.Value);

        Assert.True(draft.Id > 0);
        Assert.NotEmpty(draft.Content);
        Assert.Equal(ResponseDraftSource.Mock, draft.Source); // Mock assistant
        Assert.Equal(ResponseDraftStatus.Draft, draft.Status);
        Assert.Equal("Operator Rachel", draft.CreatedBy);
    }
}
