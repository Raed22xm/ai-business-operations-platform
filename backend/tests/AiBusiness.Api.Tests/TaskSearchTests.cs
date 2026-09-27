using AiBusiness.Api.Controllers;
using AiBusiness.Api.Data;
using AiBusiness.Api.Models;
using AiBusiness.Api.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;

namespace AiBusiness.Api.Tests;

public class TaskSearchTests : IDisposable
{
    private readonly SqliteConnection _connection;
    private readonly AppDbContext _database;
    private readonly FixedBusinessClock _clock = new(new DateOnly(2026, 9, 27));

    public TaskSearchTests()
    {
        _connection = new SqliteConnection("Data Source=:memory:");
        _connection.Open();
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseSqlite(_connection)
            .Options;
        _database = new AppDbContext(options);
        _database.Database.EnsureCreated();
    }

    public void Dispose()
    {
        _database.Dispose();
        _connection.Dispose();
    }

    [Fact]
    public async Task Search_OrdersByEarliestDueDate_UndatedLast_ThenId()
    {
        var work = await AddCase();
        var undated = await CreateTask(work.Id, "Undated", null);
        var later = await CreateTask(work.Id, "Later", new DateOnly(2026, 10, 5));
        var earlier = await CreateTask(work.Id, "Earlier", new DateOnly(2026, 9, 20));
        var sameDaySecond = await CreateTask(work.Id, "Same day B", new DateOnly(2026, 9, 20));

        var page = await Search();
        Assert.Equal(
            new[] { earlier.Id, sameDaySecond.Id, later.Id, undated.Id },
            page.Items.Select(item => item.Id).ToArray());
    }

    [Fact]
    public async Task Search_AppliesCombinedFilters_BeforeCountAndPagination()
    {
        var first = await AddCustomer("Alpha Co", "alpha@example.com");
        var second = await AddCustomer("Beta Co", "beta@example.com");
        var alphaCase = await AddCase(first.Id, "Alpha case");
        var betaCase = await AddCase(second.Id, "Beta case");

        var keep = await CreateTask(alphaCase.Id, "Needle keep", new DateOnly(2026, 9, 20), "keep desc");
        var done = await CreateTask(alphaCase.Id, "Needle done", new DateOnly(2026, 9, 20));
        await UpdateStatus(done.Id, CaseTaskStatus.Done);
        await CreateTask(betaCase.Id, "Needle other customer", new DateOnly(2026, 9, 20));
        await CreateTask(alphaCase.Id, "Different title", new DateOnly(2026, 9, 20));

        var page = await Search(
            search: "needle",
            customerId: first.Id,
            caseId: alphaCase.Id,
            status: nameof(CaseTaskStatus.Todo),
            due: "overdue",
            page: 1,
            pageSize: 10);

        Assert.Equal(1, page.TotalCount);
        var only = Assert.Single(page.Items);
        Assert.Equal(keep.Id, only.Id);
        Assert.Equal(first.Id, only.CustomerId);
        Assert.Equal("Alpha Co", only.CustomerName);
        Assert.Equal(alphaCase.Id, only.CaseId);
        Assert.Equal("Alpha case", only.CaseTitle);
        Assert.True(only.IsOverdue);
        Assert.False(only.IsDueToday);
    }

    [Fact]
    public async Task Search_DueFilters_MatchBusinessTodayBoundaries()
    {
        var work = await AddCase();
        var overdue = await CreateTask(work.Id, "Overdue", new DateOnly(2026, 9, 26));
        var today = await CreateTask(work.Id, "Today", new DateOnly(2026, 9, 27));
        var upcoming = await CreateTask(work.Id, "Upcoming", new DateOnly(2026, 9, 28));
        var none = await CreateTask(work.Id, "None", null);
        var overdueDone = await CreateTask(work.Id, "Overdue done", new DateOnly(2026, 9, 26));
        await UpdateStatus(overdueDone.Id, CaseTaskStatus.Done);

        Assert.Equal(new[] { overdue.Id }, (await Search(due: "overdue")).Items.Select(i => i.Id));
        Assert.Equal(new[] { today.Id }, (await Search(due: "today")).Items.Select(i => i.Id));
        Assert.Equal(new[] { upcoming.Id }, (await Search(due: "upcoming")).Items.Select(i => i.Id));
        Assert.Equal(new[] { none.Id }, (await Search(due: "none")).Items.Select(i => i.Id));
    }

    [Fact]
    public async Task Search_SearchMatchesTitleOrDescription_CaseInsensitive()
    {
        var work = await AddCase();
        var byTitle = await CreateTask(work.Id, "Needle Title", new DateOnly(2026, 9, 20), "plain");
        var byDescription = await CreateTask(work.Id, "Other", new DateOnly(2026, 9, 21), "Has NeEdLe here");
        await CreateTask(work.Id, "Unrelated", new DateOnly(2026, 9, 22), "nothing");

        var page = await Search(search: "needle");
        Assert.Equal(
            new[] { byTitle.Id, byDescription.Id },
            page.Items.Select(i => i.Id).ToArray());
    }

    [Fact]
    public async Task Search_PaginatesAfterFilters()
    {
        var work = await AddCase();
        for (var i = 0; i < 5; i++)
        {
            await CreateTask(work.Id, $"Task {i}", new DateOnly(2026, 9, 20 + i));
        }

        var page1 = await Search(page: 1, pageSize: 2);
        Assert.Equal(5, page1.TotalCount);
        Assert.Equal(2, page1.Items.Length);
        Assert.Equal(1, page1.Page);
        Assert.Equal(2, page1.PageSize);

        var page2 = await Search(page: 2, pageSize: 2);
        Assert.Equal(5, page2.TotalCount);
        Assert.Equal(2, page2.Items.Length);
        Assert.DoesNotContain(page2.Items, item => page1.Items.Any(first => first.Id == item.Id));
    }

    [Fact]
    public async Task Search_InvalidStatusOrDue_ReturnsValidationError()
    {
        AssertValidationProblem(await CreateController().Search(status: "Open"), "status");
        AssertValidationProblem(await CreateController().Search(due: "late"), "due");
        AssertValidationProblem(await CreateController().Search(page: 0, pageSize: 20), "page");
    }

    [Fact]
    public async Task GetAll_StillReturnsCaseScopedArray_WithoutSearchShape()
    {
        var work = await AddCase();
        await CreateTask(work.Id, "Only here", null);
        var result = await CreateController().GetAll(work.Id, null);
        var ok = Assert.IsType<OkObjectResult>(result);
        Assert.IsType<CaseTask[]>(ok.Value);
    }

    private TasksController CreateController() =>
        new(_database, new CaseActivityWriter(_database), _clock);

    private async Task<PagedResult<TaskSearchItem>> Search(
        string? search = null,
        int? customerId = null,
        int? caseId = null,
        string? status = null,
        string? due = null,
        int? page = 1,
        int? pageSize = 20)
    {
        var result = await CreateController().Search(
            search, customerId, caseId, status, priority: null, due, sort: null, page, pageSize);
        var ok = Assert.IsType<OkObjectResult>(result);
        return Assert.IsType<PagedResult<TaskSearchItem>>(ok.Value);
    }

    private async Task<Customer> AddCustomer(string name = "Studio 22", string email = "studio22@example.com")
    {
        var customer = new Customer
        {
            Name = name,
            Email = email,
            CreatedAt = DateTime.UtcNow,
        };
        _database.Customers.Add(customer);
        await _database.SaveChangesAsync();
        return customer;
    }

    private async Task<Case> AddCase(int? customerId = null, string title = "Booking page")
    {
        var id = customerId ?? (await AddCustomer()).Id;
        var work = new Case { CustomerId = id, Title = title };
        _database.Cases.Add(work);
        await _database.SaveChangesAsync();
        return work;
    }

    private async Task<CaseTask> CreateTask(
        int caseId,
        string title,
        DateOnly? dueDate,
        string? description = null)
    {
        var result = await CreateController().Create(new CaseTask
        {
            CaseId = caseId,
            Title = title,
            Description = description,
            DueDate = dueDate,
        });
        var created = Assert.IsType<CreatedAtActionResult>(result);
        return Assert.IsType<CaseTask>(created.Value);
    }

    private async Task UpdateStatus(int id, CaseTaskStatus status)
    {
        var existing = await _database.CaseTasks.FindAsync(id);
        Assert.NotNull(existing);
        existing.Status = status;
        await _database.SaveChangesAsync();
        _database.ChangeTracker.Clear();
    }

    private static void AssertValidationProblem(IActionResult result, string field)
    {
        var objectResult = Assert.IsAssignableFrom<ObjectResult>(result);
        var problem = Assert.IsType<ValidationProblemDetails>(objectResult.Value);
        Assert.True(problem.Errors.ContainsKey(field), $"Expected error for '{field}'.");
    }

    private sealed class FixedBusinessClock(DateOnly today) : IBusinessClock
    {
        public DateOnly Today { get; } = today;
        public string TimeZoneId => "Europe/Copenhagen";
    }
}
