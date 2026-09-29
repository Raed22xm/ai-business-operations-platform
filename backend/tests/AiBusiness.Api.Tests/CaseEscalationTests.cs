using AiBusiness.Api.Controllers;
using AiBusiness.Api.Data;
using AiBusiness.Api.Models;
using AiBusiness.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;

namespace AiBusiness.Api.Tests;

public class CaseEscalationTests : IDisposable
{
    private static readonly DateOnly Today = new(2026, 9, 28);
    private readonly SqliteConnection _connection;
    private readonly AppDbContext _database;
    private readonly FixedBusinessClock _clock;
    private readonly CaseEscalationService _service;

    public CaseEscalationTests()
    {
        _connection = new SqliteConnection("Data Source=:memory:");
        _connection.Open();
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseSqlite(_connection)
            .Options;
        _database = new AppDbContext(options);
        _database.Database.EnsureCreated();

        _clock = new FixedBusinessClock(Today);
        _service = new CaseEscalationService(_database, _clock);
    }

    public void Dispose()
    {
        _database.Dispose();
        _connection.Dispose();
    }

    [Fact]
    public async Task Check_CaseNotFound_ReturnsNotFound()
    {
        var result = await _service.CheckAsync(999);
        Assert.Equal(CaseEscalationResult.StatusKind.NotFound, result.Status);
        Assert.Null(result.Data);
    }

    [Fact]
    public async Task Check_ArchivedCase_ReturnsArchived()
    {
        var customer = await AddCustomer();
        var work = await AddCase(customer.Id, "Archived case", CaseStatus.Closed, isArchived: true);

        var result = await _service.CheckAsync(work.Id);
        Assert.Equal(CaseEscalationResult.StatusKind.Archived, result.Status);
    }

    [Fact]
    public async Task Check_Rule1_OverdueUnfinishedTask_FlagsAsNeedsReview()
    {
        var customer = await AddCustomer();
        var work = await AddCase(customer.Id, "Active case", CaseStatus.InProgress);
        var yesterday = Today.AddDays(-1);
        var task = await AddTask(work.Id, "Overdue call", CaseTaskStatus.Todo, CaseTaskPriority.Normal, yesterday);

        var result = await _service.CheckAsync(work.Id);
        Assert.Equal(CaseEscalationResult.StatusKind.Success, result.Status);
        Assert.NotNull(result.Data);
        Assert.True(result.Data.NeedsReview);
        Assert.Single(result.Data.Flags);

        var flag = result.Data.Flags[0];
        Assert.Equal("OverdueTask", flag.Rule);
        Assert.Equal(task.Id, flag.TaskId);
        Assert.Equal("Overdue call", flag.TaskTitle);
        Assert.Equal("NeedsReview", flag.Severity);
        Assert.Contains("overdue", flag.Reason);
    }

    [Fact]
    public async Task Check_Rule2_HighPriorityUnfinishedTask_FlagsAsNeedsReview()
    {
        var customer = await AddCustomer();
        var work = await AddCase(customer.Id, "Active case", CaseStatus.InProgress);
        var tomorrow = Today.AddDays(1);
        var task = await AddTask(work.Id, "Critical security review", CaseTaskStatus.InProgress, CaseTaskPriority.High, tomorrow);

        var result = await _service.CheckAsync(work.Id);
        Assert.Equal(CaseEscalationResult.StatusKind.Success, result.Status);
        Assert.NotNull(result.Data);
        Assert.True(result.Data.NeedsReview);
        Assert.Single(result.Data.Flags);

        var flag = result.Data.Flags[0];
        Assert.Equal("HighPriorityTask", flag.Rule);
        Assert.Equal(task.Id, flag.TaskId);
        Assert.Equal("Critical security review", flag.TaskTitle);
        Assert.Equal("NeedsReview", flag.Severity);
        Assert.Contains("High-priority task", flag.Reason);
    }

    [Fact]
    public async Task Check_Rule3_OpenCase_NoTasks_FlagsAsNeedsReview()
    {
        var customer = await AddCustomer();
        var work = await AddCase(customer.Id, "Empty open case", CaseStatus.Open);

        var result = await _service.CheckAsync(work.Id);
        Assert.Equal(CaseEscalationResult.StatusKind.Success, result.Status);
        Assert.NotNull(result.Data);
        Assert.True(result.Data.NeedsReview);
        Assert.Single(result.Data.Flags);

        var flag = result.Data.Flags[0];
        Assert.Equal("NoUnfinishedTasks", flag.Rule);
        Assert.Null(flag.TaskId);
        Assert.Equal("NeedsReview", flag.Severity);
        Assert.Contains("no unfinished tasks", flag.Reason);
    }

    [Fact]
    public async Task Check_Rule3_InProgressCase_AllTasksDone_FlagsAsNeedsReview()
    {
        var customer = await AddCustomer();
        var work = await AddCase(customer.Id, "In progress all done", CaseStatus.InProgress);
        await AddTask(work.Id, "Done task 1", CaseTaskStatus.Done, CaseTaskPriority.Normal, Today.AddDays(-1));
        await AddTask(work.Id, "Done task 2", CaseTaskStatus.Done, CaseTaskPriority.High, Today);

        var result = await _service.CheckAsync(work.Id);
        Assert.Equal(CaseEscalationResult.StatusKind.Success, result.Status);
        Assert.NotNull(result.Data);
        Assert.True(result.Data.NeedsReview);
        Assert.Single(result.Data.Flags);
        Assert.Equal("NoUnfinishedTasks", result.Data.Flags[0].Rule);
    }

    [Fact]
    public async Task Check_Rule3_ClosedCase_NoTasks_DoesNotFlagNoTasks()
    {
        var customer = await AddCustomer();
        var work = await AddCase(customer.Id, "Closed case", CaseStatus.Closed);

        var result = await _service.CheckAsync(work.Id);
        Assert.Equal(CaseEscalationResult.StatusKind.Success, result.Status);
        Assert.NotNull(result.Data);
        Assert.False(result.Data.NeedsReview);
        Assert.Empty(result.Data.Flags);
        Assert.Equal("No attention flags found.", result.Data.SummaryMessage);
    }

    [Fact]
    public async Task Check_CombinedFlags_MultipleRulesTriggeredTogether()
    {
        var customer = await AddCustomer();
        var work = await AddCase(customer.Id, "Complex case", CaseStatus.InProgress);

        // Task 1: Overdue and Normal priority -> 1 flag (OverdueTask)
        await AddTask(work.Id, "Late normal task", CaseTaskStatus.Todo, CaseTaskPriority.Normal, Today.AddDays(-2));

        // Task 2: Both Overdue and High Priority -> 2 flags (OverdueTask and HighPriorityTask)
        await AddTask(work.Id, "Late urgent task", CaseTaskStatus.Todo, CaseTaskPriority.High, Today.AddDays(-1));

        // Task 3: Upcoming and High Priority -> 1 flag (HighPriorityTask)
        await AddTask(work.Id, "Future urgent task", CaseTaskStatus.InProgress, CaseTaskPriority.High, Today.AddDays(3));

        var result = await _service.CheckAsync(work.Id);
        Assert.Equal(CaseEscalationResult.StatusKind.Success, result.Status);
        Assert.NotNull(result.Data);
        Assert.True(result.Data.NeedsReview);
        Assert.Equal(4, result.Data.Flags.Count);
        Assert.Contains(result.Data.Flags, f => f.Rule == "OverdueTask" && f.TaskTitle == "Late normal task");
        Assert.Contains(result.Data.Flags, f => f.Rule == "OverdueTask" && f.TaskTitle == "Late urgent task");
        Assert.Contains(result.Data.Flags, f => f.Rule == "HighPriorityTask" && f.TaskTitle == "Late urgent task");
        Assert.Contains(result.Data.Flags, f => f.Rule == "HighPriorityTask" && f.TaskTitle == "Future urgent task");
        Assert.Equal("4 items need review.", result.Data.SummaryMessage);
    }

    [Fact]
    public async Task Check_DateBoundaries_DueTodayOrTomorrowOrNull_NotOverdue()
    {
        var customer = await AddCustomer();
        var work = await AddCase(customer.Id, "Boundary case", CaseStatus.InProgress);

        // Due today -> Not overdue
        await AddTask(work.Id, "Today task", CaseTaskStatus.Todo, CaseTaskPriority.Normal, Today);

        // Due tomorrow -> Not overdue
        await AddTask(work.Id, "Tomorrow task", CaseTaskStatus.Todo, CaseTaskPriority.Normal, Today.AddDays(1));

        // No due date -> Not overdue
        await AddTask(work.Id, "No due date task", CaseTaskStatus.InProgress, CaseTaskPriority.Normal, null);

        var result = await _service.CheckAsync(work.Id);
        Assert.Equal(CaseEscalationResult.StatusKind.Success, result.Status);
        Assert.NotNull(result.Data);
        Assert.False(result.Data.NeedsReview);
        Assert.Empty(result.Data.Flags);
        Assert.Equal("No attention flags found.", result.Data.SummaryMessage);
    }

    [Fact]
    public async Task Check_CompletedTasks_DoneOverdueOrDoneHighPriority_DoNotFlag()
    {
        var customer = await AddCustomer();
        var work = await AddCase(customer.Id, "Done tasks case", CaseStatus.InProgress);

        // Done task with past date -> Not overdue
        await AddTask(work.Id, "Completed late task", CaseTaskStatus.Done, CaseTaskPriority.Normal, Today.AddDays(-5));

        // Done task with high priority -> Not unfinished high-priority
        await AddTask(work.Id, "Completed urgent task", CaseTaskStatus.Done, CaseTaskPriority.High, Today.AddDays(-2));

        // Active task with normal priority and future date
        await AddTask(work.Id, "Active regular task", CaseTaskStatus.Todo, CaseTaskPriority.Normal, Today.AddDays(2));

        var result = await _service.CheckAsync(work.Id);
        Assert.Equal(CaseEscalationResult.StatusKind.Success, result.Status);
        Assert.NotNull(result.Data);
        Assert.False(result.Data.NeedsReview);
        Assert.Empty(result.Data.Flags);
        Assert.Equal("No attention flags found.", result.Data.SummaryMessage);
    }

    [Fact]
    public async Task Controller_CheckEscalation_ReturnsOkWithResponse()
    {
        var customer = await AddCustomer();
        var work = await AddCase(customer.Id, "API check", CaseStatus.Open);
        await AddTask(work.Id, "Urgent task", CaseTaskStatus.Todo, CaseTaskPriority.High, Today);

        var controller = new CasesController(_database, new CaseActivityWriter(_database), TestCsvExport.Service(), _service);
        var actionResult = await controller.CheckEscalation(work.Id, default);

        var okResult = Assert.IsType<OkObjectResult>(actionResult);
        var response = Assert.IsType<CaseEscalationResponse>(okResult.Value);
        Assert.Equal(work.Id, response.CaseId);
        Assert.True(response.NeedsReview);
        Assert.Single(response.Flags);
    }

    [Fact]
    public async Task Controller_CheckEscalation_ArchivedCase_ReturnsConflict()
    {
        var customer = await AddCustomer();
        var work = await AddCase(customer.Id, "Archived API check", CaseStatus.Closed, isArchived: true);

        var controller = new CasesController(_database, new CaseActivityWriter(_database), TestCsvExport.Service(), _service);
        var actionResult = await controller.CheckEscalation(work.Id, default);

        var problem = Assert.IsType<ObjectResult>(actionResult);
        Assert.Equal(409, problem.StatusCode);
    }

    [Fact]
    public void Endpoint_DoesNotAllowAnonymous_RequiresAuthentication()
    {
        var method = typeof(AssistantController).GetMethod(nameof(AssistantController.CheckEscalation));
        Assert.NotNull(method);
        Assert.Empty(method.GetCustomAttributes(typeof(Microsoft.AspNetCore.Authorization.AllowAnonymousAttribute), true));

        var casesMethod = typeof(CasesController).GetMethod(nameof(CasesController.CheckEscalation));
        Assert.NotNull(casesMethod);
        Assert.Empty(casesMethod.GetCustomAttributes(typeof(Microsoft.AspNetCore.Authorization.AllowAnonymousAttribute), true));
    }

    private async Task<Customer> AddCustomer()
    {
        var customer = new Customer
        {
            Name = "Test Client",
            Email = $"client.{Guid.NewGuid():N}@example.com",
            CreatedAt = DateTime.UtcNow,
        };
        _database.Customers.Add(customer);
        await _database.SaveChangesAsync();
        return customer;
    }

    private async Task<Case> AddCase(int customerId, string title, CaseStatus status, bool isArchived = false)
    {
        var work = new Case
        {
            CustomerId = customerId,
            Title = title,
            Status = status,
            CreatedAt = DateTime.UtcNow,
        };
        _database.Cases.Add(work);
        await _database.SaveChangesAsync();

        if (isArchived)
        {
            work.ArchivedAt = DateTime.UtcNow;
            await _database.SaveChangesAsync();
        }

        return work;
    }

    private async Task<CaseTask> AddTask(int caseId, string title, CaseTaskStatus status, CaseTaskPriority priority, DateOnly? dueDate)
    {
        var task = new CaseTask
        {
            CaseId = caseId,
            Title = title,
            Status = status,
            Priority = priority,
            DueDate = dueDate,
            CreatedAt = DateTime.UtcNow,
        };
        _database.CaseTasks.Add(task);
        await _database.SaveChangesAsync();
        return task;
    }

    private sealed class FixedBusinessClock(DateOnly today, string timeZoneId = "Europe/Copenhagen") : IBusinessClock
    {
        public DateOnly Today => today;
        public string TimeZoneId => timeZoneId;
    }
}
