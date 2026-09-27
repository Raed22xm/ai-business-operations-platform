using System.Security.Claims;
using AiBusiness.Api.Controllers;
using AiBusiness.Api.Data;
using AiBusiness.Api.Models;
using AiBusiness.Api.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;

namespace AiBusiness.Api.Tests;

public class TaskPriorityTests : IDisposable
{
    private readonly SqliteConnection _connection;
    private readonly AppDbContext _database;
    private readonly FixedBusinessClock _clock = new(new DateOnly(2026, 9, 27));

    public TaskPriorityTests()
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
    public async Task Create_OmittingPriority_DefaultsToNormal()
    {
        var work = await SeedCase();
        var result = await Tasks().Create(new CaseTask
        {
            CaseId = work.Id,
            Title = "No priority",
        });
        var created = Assert.IsType<CaseTask>(Assert.IsType<CreatedAtActionResult>(result).Value);
        Assert.Equal(CaseTaskPriority.Normal, created.Priority);
    }

    [Fact]
    public async Task Create_ExplicitPriority_IsStored()
    {
        var work = await SeedCase();
        var result = await Tasks().Create(new CaseTask
        {
            CaseId = work.Id,
            Title = "Urgent",
            Priority = CaseTaskPriority.High,
        });
        var created = Assert.IsType<CaseTask>(Assert.IsType<CreatedAtActionResult>(result).Value);
        Assert.Equal(CaseTaskPriority.High, created.Priority);
    }

    [Fact]
    public async Task Update_OmittingPriority_PreservesExisting()
    {
        var work = await SeedCase();
        var created = Assert.IsType<CaseTask>(Assert.IsType<CreatedAtActionResult>(
            await Tasks().Create(new CaseTask
            {
                CaseId = work.Id,
                Title = "Keep priority",
                Priority = CaseTaskPriority.High,
            })).Value);

        var updated = Assert.IsType<CaseTask>(Assert.IsType<OkObjectResult>(
            await Tasks().Update(created.Id, new CaseTaskUpdate
            {
                Title = "Keep priority",
                Description = null,
                DueDate = null,
                Status = nameof(CaseTaskStatus.InProgress),
                Priority = null,
            })).Value);

        Assert.Equal(CaseTaskPriority.High, updated.Priority);
        Assert.Equal(CaseTaskStatus.InProgress, updated.Status);
    }

    [Fact]
    public async Task Update_InvalidPriority_Returns400_WithoutChanging()
    {
        var work = await SeedCase();
        var created = Assert.IsType<CaseTask>(Assert.IsType<CreatedAtActionResult>(
            await Tasks().Create(new CaseTask
            {
                CaseId = work.Id,
                Title = "Stable",
                Priority = CaseTaskPriority.Low,
            })).Value);

        var bad = Assert.IsAssignableFrom<ObjectResult>(
            await Tasks().Update(created.Id, new CaseTaskUpdate
            {
                Title = "Stable",
                Status = nameof(CaseTaskStatus.Todo),
                Priority = "Urgent",
            }));
        var problem = Assert.IsType<ValidationProblemDetails>(bad.Value);
        Assert.True(problem.Errors.ContainsKey(nameof(CaseTaskUpdate.Priority)));
        Assert.Equal(CaseTaskPriority.Low, (await _database.CaseTasks.FindAsync(created.Id))!.Priority);
    }

    [Fact]
    public async Task Update_PriorityChange_RecordsActivity()
    {
        var work = await SeedCase();
        var tasks = Tasks();
        SetActor(tasks, "workspace-user");
        var created = Assert.IsType<CaseTask>(Assert.IsType<CreatedAtActionResult>(
            await tasks.Create(new CaseTask
            {
                CaseId = work.Id,
                Title = "Raise",
                Priority = CaseTaskPriority.Normal,
            })).Value);

        await tasks.Update(created.Id, new CaseTaskUpdate
        {
            Title = "Raise",
            Status = nameof(CaseTaskStatus.Todo),
            Priority = nameof(CaseTaskPriority.High),
        });

        var activity = await _database.CaseActivities
            .AsNoTracking()
            .Where(a => a.CaseId == work.Id && a.EventType == CaseActivityEventType.TaskUpdated)
            .OrderByDescending(a => a.Id)
            .FirstAsync();
        Assert.Equal("Task priority changed to High", activity.Description);
    }

    [Fact]
    public async Task Search_FiltersAndSortsByPriority()
    {
        var work = await SeedCase();
        await Tasks().Create(new CaseTask
        {
            CaseId = work.Id,
            Title = "Low item",
            Priority = CaseTaskPriority.Low,
            DueDate = new DateOnly(2026, 10, 1),
        });
        await Tasks().Create(new CaseTask
        {
            CaseId = work.Id,
            Title = "High item",
            Priority = CaseTaskPriority.High,
            DueDate = new DateOnly(2026, 10, 5),
        });
        await Tasks().Create(new CaseTask
        {
            CaseId = work.Id,
            Title = "Normal item",
            Priority = CaseTaskPriority.Normal,
            DueDate = new DateOnly(2026, 9, 20),
        });

        var highOnly = Assert.IsType<PagedResult<TaskSearchItem>>(
            Assert.IsType<OkObjectResult>(
                await Tasks().Search(priority: "High", sort: "priority")).Value);
        Assert.Single(highOnly.Items);
        Assert.Equal("High item", highOnly.Items[0].Title);

        var byPriority = Assert.IsType<PagedResult<TaskSearchItem>>(
            Assert.IsType<OkObjectResult>(
                await Tasks().Search(sort: "priority")).Value);
        Assert.Equal(
            new[] { "High item", "Normal item", "Low item" },
            byPriority.Items.Select(item => item.Title).ToArray());

        var byDue = Assert.IsType<PagedResult<TaskSearchItem>>(
            Assert.IsType<OkObjectResult>(
                await Tasks().Search(sort: "due")).Value);
        Assert.Equal(
            new[] { "Normal item", "Low item", "High item" },
            byDue.Items.Select(item => item.Title).ToArray());
    }

    [Fact]
    public async Task DashboardOutstanding_IncludesPriority()
    {
        var work = await SeedCase();
        await Tasks().Create(new CaseTask
        {
            CaseId = work.Id,
            Title = "Dashboard priority",
            Priority = CaseTaskPriority.High,
        });

        var summary = Assert.IsType<DashboardSummary>(
            Assert.IsType<OkObjectResult>(
                await new DashboardController(_database, _clock).GetSummary()).Value);
        Assert.Contains(summary.OutstandingTasks, item =>
            item.Title == "Dashboard priority" && item.Priority == CaseTaskPriority.High);
    }

    private TasksController Tasks() =>
        new(_database, new CaseActivityWriter(_database), _clock);

    private void SetActor(ControllerBase controller, string name)
    {
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext
            {
                User = new ClaimsPrincipal(
                    new ClaimsIdentity(
                        [new Claim(ClaimTypes.Name, name)],
                        authenticationType: "Test")),
            },
        };
    }

    private async Task<Case> SeedCase()
    {
        var customer = new Customer
        {
            Name = "Priority Customer",
            Email = $"{Guid.NewGuid():N}@example.com",
        };
        _database.Customers.Add(customer);
        await _database.SaveChangesAsync();
        var work = new Case
        {
            CustomerId = customer.Id,
            Title = "Priority case",
            Status = CaseStatus.Open,
        };
        _database.Cases.Add(work);
        await _database.SaveChangesAsync();
        return work;
    }

    private sealed class FixedBusinessClock(DateOnly today) : IBusinessClock
    {
        public DateOnly Today => today;
        public string TimeZoneId => "Europe/Copenhagen";
    }
}
