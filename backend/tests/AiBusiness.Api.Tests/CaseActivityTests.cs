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

public class CaseActivityTests : IDisposable
{
    private readonly SqliteConnection _connection;
    private readonly AppDbContext _database;

    public CaseActivityTests()
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
    public async Task SuccessfulCaseAndTaskChanges_RecordActivity_NewestFirst()
    {
        var customer = await AddCustomer();
        var cases = Cases();
        SetActor(cases, "workspace-user");

        var created = await CreateCase(cases, customer.Id, "Activity case", "Desc");
        await cases.Update(created.Id, new CaseUpdate
        {
            Title = "Activity case",
            Description = "Desc",
            Status = nameof(CaseStatus.Closed),
        });

        var tasks = Tasks();
        SetActor(tasks, "workspace-user");
        var task = await CreateTask(tasks, created.Id, "Do work");
        await tasks.Update(task.Id, new CaseTaskUpdate
        {
            Title = "Do work",
            Description = null,
            DueDate = null,
            Status = nameof(CaseTaskStatus.Done),
        });
        await tasks.Delete(task.Id);

        var page = await ListActivity(created.Id, page: 1, pageSize: 20);
        Assert.Equal(5, page.TotalCount);
        Assert.Equal(
            new[]
            {
                CaseActivityEventType.TaskDeleted,
                CaseActivityEventType.TaskCompleted,
                CaseActivityEventType.TaskCreated,
                CaseActivityEventType.CaseStatusChanged,
                CaseActivityEventType.CaseCreated,
            },
            page.Items.Select(item => item.EventType).ToArray());
        Assert.Equal("Task marked Done", page.Items[1].Description);
        Assert.Equal("Case status changed to Closed", page.Items[3].Description);
        Assert.All(page.Items, item => Assert.Equal("workspace-user", item.ActorName));
        Assert.True(page.Items[0].OccurredAt >= page.Items[^1].OccurredAt);
    }

    [Fact]
    public async Task FailedValidation_DoesNotRecordActivity()
    {
        var customer = await AddCustomer();
        var cases = Cases();
        var created = await CreateCase(cases, customer.Id, "Keep", null);
        var before = await _database.CaseActivities.CountAsync();

        var bad = await cases.Update(created.Id, new CaseUpdate
        {
            Title = "",
            Description = null,
            Status = "Nope",
        });
        Assert.IsAssignableFrom<ObjectResult>(bad);
        Assert.Equal(before, await _database.CaseActivities.CountAsync());

        var tasks = Tasks();
        var badTask = await tasks.Create(new CaseTask { CaseId = created.Id, Title = "" });
        Assert.IsAssignableFrom<ObjectResult>(badTask);
        Assert.Equal(before, await _database.CaseActivities.CountAsync());
    }

    [Fact]
    public async Task NoOpTaskUpdate_DoesNotDuplicateActivity()
    {
        var customer = await AddCustomer();
        var work = await CreateCase(Cases(), customer.Id, "Case", null);
        var tasks = Tasks();
        var task = await CreateTask(tasks, work.Id, "Same");
        var before = await _database.CaseActivities.CountAsync();

        await tasks.Update(task.Id, new CaseTaskUpdate
        {
            Title = "Same",
            Description = null,
            DueDate = null,
            Status = nameof(CaseTaskStatus.Todo),
        });

        Assert.Equal(before, await _database.CaseActivities.CountAsync());
    }

    [Fact]
    public async Task Activity_Paginates_StableNewestFirst()
    {
        var customer = await AddCustomer();
        var work = await CreateCase(Cases(), customer.Id, "Paged", null);
        var tasks = Tasks();
        for (var i = 0; i < 5; i++)
        {
            await CreateTask(tasks, work.Id, $"Task {i}");
        }

        var page1 = await ListActivity(work.Id, page: 1, pageSize: 3);
        var page2 = await ListActivity(work.Id, page: 2, pageSize: 3);

        Assert.Equal(6, page1.TotalCount); // 1 case created + 5 tasks
        Assert.Equal(3, page1.Items.Length);
        Assert.Equal(3, page2.Items.Length);
        Assert.Empty(page1.Items.Select(i => i.Id).Intersect(page2.Items.Select(i => i.Id)));
        Assert.True(page1.Items[0].OccurredAt >= page2.Items[0].OccurredAt
            || page1.Items[0].Id > page2.Items[0].Id);
    }

    [Fact]
    public async Task Activity_UnknownCase_ReturnsNotFound()
    {
        var result = await new CaseActivityController(_database).GetForCase(int.MaxValue);
        Assert.IsType<NotFoundResult>(result);
    }

    [Fact]
    public async Task DeleteCase_CascadesActivity()
    {
        var customer = await AddCustomer();
        var work = await CreateCase(Cases(), customer.Id, "Delete me", null);
        Assert.True(await _database.CaseActivities.AnyAsync(a => a.CaseId == work.Id));

        Assert.IsType<NoContentResult>(await Cases().Delete(work.Id));
        Assert.False(await _database.CaseActivities.AnyAsync(a => a.CaseId == work.Id));
    }

    private CasesController Cases() =>
        new(_database, new CaseActivityWriter(_database), TestCsvExport.Service());

    private TasksController Tasks() =>
        new(_database, new CaseActivityWriter(_database), new FixedBusinessClock(new DateOnly(2026, 9, 27)));

    private sealed class FixedBusinessClock(DateOnly today) : IBusinessClock
    {
        public DateOnly Today { get; } = today;
        public string TimeZoneId => "Europe/Copenhagen";
    }

    private static void SetActor(ControllerBase controller, string name)
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

    private async Task<PagedResult<CaseActivity>> ListActivity(int caseId, int page, int pageSize)
    {
        var result = await new CaseActivityController(_database).GetForCase(caseId, page, pageSize);
        var ok = Assert.IsType<OkObjectResult>(result);
        return Assert.IsType<PagedResult<CaseActivity>>(ok.Value);
    }

    private async Task<Customer> AddCustomer()
    {
        var customer = new Customer
        {
            Name = "Activity Customer",
            Email = $"activity.{Guid.NewGuid():N}@example.com",
            CreatedAt = DateTime.UtcNow,
        };
        _database.Customers.Add(customer);
        await _database.SaveChangesAsync();
        return customer;
    }

    private async Task<Case> CreateCase(CasesController controller, int customerId, string title, string? description)
    {
        var result = await controller.Create(new Case
        {
            CustomerId = customerId,
            Title = title,
            Description = description,
        });
        var created = Assert.IsType<CreatedAtActionResult>(result);
        return Assert.IsType<Case>(created.Value);
    }

    private async Task<CaseTask> CreateTask(TasksController controller, int caseId, string title)
    {
        var result = await controller.Create(new CaseTask
        {
            CaseId = caseId,
            Title = title,
        });
        var created = Assert.IsType<CreatedAtActionResult>(result);
        return Assert.IsType<CaseTask>(created.Value);
    }
}
