using AiBusiness.Api.Controllers;
using AiBusiness.Api.Data;
using AiBusiness.Api.Models;
using AiBusiness.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;

namespace AiBusiness.Api.Tests;

public class DashboardControllerTests : IDisposable
{
    private readonly SqliteConnection _connection;
    private readonly AppDbContext _database;
    private readonly FixedBusinessClock _clock = new(new DateOnly(2026, 9, 27));

    public DashboardControllerTests()
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
    public async Task GetSummary_WhenEmpty_ReturnsZeroCounts()
    {
        var summary = await GetSummary();

        Assert.Equal(0, summary.TotalCustomers);
        Assert.Equal(0, summary.TotalCases);
        Assert.Equal(0, summary.OpenCases);
        Assert.Equal(0, summary.InProgressCases);
        Assert.Equal(0, summary.ClosedCases);
        Assert.Equal(0, summary.OverdueTasks);
        Assert.Equal(0, summary.DueTodayTasks);
        Assert.Empty(summary.OutstandingTasks);
        Assert.Equal("2026-09-27", summary.BusinessToday);
    }

    [Fact]
    public async Task GetSummary_CountsCustomersAndCasesByStatus()
    {
        var first = await AddCustomer("Alpha", "alpha-dash@example.com");
        var second = await AddCustomer("Beta", "beta-dash@example.com");
        await CreateCase(first.Id, "Open one", null);
        await CreateCase(first.Id, "Open two", null);
        var progress = await CreateCase(second.Id, "Progress one", null);
        var closed = await CreateCase(second.Id, "Closed one", null);
        await UpdateCase(progress.Id, "Progress one", null, nameof(CaseStatus.InProgress));
        await UpdateCase(closed.Id, "Closed one", null, nameof(CaseStatus.Closed));

        var summary = await GetSummary();

        Assert.Equal(2, summary.TotalCustomers);
        Assert.Equal(4, summary.TotalCases);
        Assert.Equal(2, summary.OpenCases);
        Assert.Equal(1, summary.InProgressCases);
        Assert.Equal(1, summary.ClosedCases);
    }

    [Fact]
    public async Task GetSummary_UpdatesAfterStatusChangeAndDeletion()
    {
        var customer = await AddCustomer();
        var openCase = await CreateCase(customer.Id, "Move me", null);
        var keepOpen = await CreateCase(customer.Id, "Stay open", null);
        var toDelete = await CreateCase(customer.Id, "Delete me", null);

        var before = await GetSummary();
        Assert.Equal(1, before.TotalCustomers);
        Assert.Equal(3, before.TotalCases);
        Assert.Equal(3, before.OpenCases);
        Assert.Equal(0, before.InProgressCases);
        Assert.Equal(0, before.ClosedCases);

        await UpdateCase(openCase.Id, "Move me", null, nameof(CaseStatus.Closed));
        Assert.IsType<NoContentResult>(await new CasesController(_database, new AiBusiness.Api.Services.CaseActivityWriter(_database), TestCsvExport.Service()).Delete(toDelete.Id));

        var after = await GetSummary();
        Assert.Equal(1, after.TotalCustomers);
        Assert.Equal(2, after.TotalCases);
        Assert.Equal(1, after.OpenCases);
        Assert.Equal(0, after.InProgressCases);
        Assert.Equal(1, after.ClosedCases);
        Assert.Equal(keepOpen.Id, (await ListCaseIds()).Single(id => id == keepOpen.Id));
    }

    [Fact]
    public async Task GetSummary_TaskDueVisibility_UsesClockAndExcludesDone()
    {
        var customer = await AddCustomer();
        var work = await CreateCase(customer.Id, "Due visibility case", null);
        await CreateTask(work.Id, "Yesterday open", new DateOnly(2026, 9, 26), CaseTaskStatus.Todo);
        await CreateTask(work.Id, "Today open", new DateOnly(2026, 9, 27), CaseTaskStatus.InProgress);
        await CreateTask(work.Id, "Tomorrow open", new DateOnly(2026, 9, 28), CaseTaskStatus.Todo);
        await CreateTask(work.Id, "No due", null, CaseTaskStatus.Todo);
        await CreateTask(work.Id, "Yesterday done", new DateOnly(2026, 9, 26), CaseTaskStatus.Done);

        var summary = await GetSummary();

        Assert.Equal(1, summary.OverdueTasks);
        Assert.Equal(1, summary.DueTodayTasks);
        Assert.Equal(4, summary.OutstandingTasks.Length);
        Assert.Equal(
            new[] { "Yesterday open", "Today open", "Tomorrow open", "No due" },
            summary.OutstandingTasks.Select(t => t.Title).ToArray());
        Assert.True(summary.OutstandingTasks[0].IsOverdue);
        Assert.True(summary.OutstandingTasks[1].IsDueToday);
        Assert.All(summary.OutstandingTasks, item => Assert.Equal(work.Id, item.CaseId));
        Assert.All(summary.OutstandingTasks, item => Assert.Equal("Due visibility case", item.CaseTitle));
    }

    [Fact]
    public async Task GetSummary_OutstandingList_OrdersEarliestDueFirst_AcrossCases()
    {
        var customer = await AddCustomer();
        var first = await CreateCase(customer.Id, "Case A", null);
        var second = await CreateCase(customer.Id, "Case B", null);
        await CreateTask(second.Id, "Later", new DateOnly(2026, 9, 30), CaseTaskStatus.Todo);
        await CreateTask(first.Id, "Sooner", new DateOnly(2026, 9, 20), CaseTaskStatus.Todo);

        var summary = await GetSummary();

        Assert.Equal(1, summary.OverdueTasks);
        Assert.Equal("Sooner", summary.OutstandingTasks[0].Title);
        Assert.Equal(first.Id, summary.OutstandingTasks[0].CaseId);
        Assert.Equal("Later", summary.OutstandingTasks[1].Title);
    }

    private async Task<DashboardSummary> GetSummary()
    {
        var result = await new DashboardController(_database, _clock).GetSummary();
        var ok = Assert.IsType<OkObjectResult>(result);
        return Assert.IsType<DashboardSummary>(ok.Value);
    }

    private async Task<Customer> AddCustomer(
        string name = "Studio 22",
        string email = "studio22@example.com")
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

    private async Task<Case> CreateCase(int customerId, string title, string? description)
    {
        var result = await new CasesController(_database, new AiBusiness.Api.Services.CaseActivityWriter(_database), TestCsvExport.Service()).Create(new Case
        {
            CustomerId = customerId,
            Title = title,
            Description = description,
        });
        var created = Assert.IsType<CreatedAtActionResult>(result);
        return Assert.IsType<Case>(created.Value);
    }

    private async Task<Case> UpdateCase(int id, string title, string? description, string status)
    {
        var result = await new CasesController(_database, new AiBusiness.Api.Services.CaseActivityWriter(_database), TestCsvExport.Service()).Update(id, new CaseUpdate
        {
            Title = title,
            Description = description,
            Status = status,
        });
        var ok = Assert.IsType<OkObjectResult>(result);
        return Assert.IsType<Case>(ok.Value);
    }

    private async Task CreateTask(int caseId, string title, DateOnly? dueDate, CaseTaskStatus status)
    {
        var create = await new TasksController(_database, new AiBusiness.Api.Services.CaseActivityWriter(_database), _clock).Create(new CaseTask
        {
            CaseId = caseId,
            Title = title,
            DueDate = dueDate,
        });
        var created = Assert.IsType<CreatedAtActionResult>(create);
        var task = Assert.IsType<CaseTask>(created.Value);
        if (status == CaseTaskStatus.Todo)
        {
            return;
        }

        var update = await new TasksController(_database, new AiBusiness.Api.Services.CaseActivityWriter(_database), _clock).Update(
            task.Id,
            new CaseTaskUpdate
            {
                Title = title,
                Description = null,
                DueDate = dueDate,
                Status = status.ToString(),
            });
        Assert.IsType<OkObjectResult>(update);
    }

    private async Task<int[]> ListCaseIds()
    {
        var result = await new CasesController(_database, new AiBusiness.Api.Services.CaseActivityWriter(_database), TestCsvExport.Service()).GetAll();
        var ok = Assert.IsType<OkObjectResult>(result);
        return Assert.IsType<Case[]>(ok.Value).Select(work => work.Id).ToArray();
    }

    private sealed class FixedBusinessClock(DateOnly today) : IBusinessClock
    {
        public DateOnly Today { get; } = today;
        public string TimeZoneId => "Europe/Copenhagen";
    }
}
