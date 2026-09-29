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

public class CustomerActivityTests : IDisposable
{
    private readonly SqliteConnection _connection;
    private readonly AppDbContext _database;

    public CustomerActivityTests()
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
    public async Task GetForCustomer_ReturnsNotFound_WhenCustomerDoesNotExist()
    {
        var controller = CustomerActivity();
        var result = await controller.GetForCustomer(999);
        Assert.IsType<NotFoundResult>(result);
    }

    [Fact]
    public async Task GetForCustomer_ReturnsEmptyList_WhenNoCasesOrActivity()
    {
        var customer = await AddCustomer("Quiet Client");
        var controller = CustomerActivity();

        var result = await controller.GetForCustomer(customer.Id);
        var ok = Assert.IsType<OkObjectResult>(result);
        var page = Assert.IsType<PagedResult<CustomerActivityItem>>(ok.Value);

        Assert.Equal(0, page.TotalCount);
        Assert.Empty(page.Items);
    }

    [Fact]
    public async Task GetForCustomer_ReturnsAggregatedActivityAcrossCases_NewestFirst()
    {
        var customer = await AddCustomer("Active Client");
        var casesController = Cases();
        SetActor(casesController, "agent-1");

        // Case 1
        var case1 = await CreateCase(casesController, customer.Id, "Case Alpha", "First work");
        // Case 2
        var case2 = await CreateCase(casesController, customer.Id, "Case Beta", "Second work");

        // Add task to Case 1
        var tasksController = Tasks();
        SetActor(tasksController, "agent-1");
        var task = await CreateTask(tasksController, case1.Id, "Review documents");

        // Complete task in Case 1
        await tasksController.Update(task.Id, new CaseTaskUpdate
        {
            Title = "Review documents",
            Description = null,
            DueDate = null,
            Status = nameof(CaseTaskStatus.Done),
        });

        // Query customer activity
        var customerActivityController = CustomerActivity();
        var result = await customerActivityController.GetForCustomer(customer.Id);
        var ok = Assert.IsType<OkObjectResult>(result);
        var page = Assert.IsType<PagedResult<CustomerActivityItem>>(ok.Value);

        // Expect 4 events: Task Completed, Task Created, Case 2 Created, Case 1 Created
        Assert.Equal(4, page.TotalCount);
        Assert.Equal(CaseActivityEventType.TaskCompleted, page.Items[0].EventType);
        Assert.Equal("Task marked Done", page.Items[0].Description);
        Assert.Equal("Case Alpha", page.Items[0].CaseTitle);
        Assert.Equal(case1.Id, page.Items[0].CaseId);

        Assert.Equal(CaseActivityEventType.TaskCreated, page.Items[1].EventType);
        Assert.Equal(case1.Id, page.Items[1].CaseId);

        Assert.Equal(CaseActivityEventType.CaseCreated, page.Items[2].EventType);
        Assert.Equal("Case Beta", page.Items[2].CaseTitle);
        Assert.Equal(case2.Id, page.Items[2].CaseId);

        Assert.Equal(CaseActivityEventType.CaseCreated, page.Items[3].EventType);
        Assert.Equal("Case Alpha", page.Items[3].CaseTitle);
        Assert.Equal(case1.Id, page.Items[3].CaseId);
    }

    [Fact]
    public async Task GetForCustomer_ExcludesActivityFromOtherCustomers()
    {
        var customer1 = await AddCustomer("Client One");
        var customer2 = await AddCustomer("Client Two");

        var casesController = Cases();
        SetActor(casesController, "agent-1");

        await CreateCase(casesController, customer1.Id, "Case for One", "Desc");
        await CreateCase(casesController, customer2.Id, "Case for Two", "Desc");

        var controller = CustomerActivity();
        var result1 = await controller.GetForCustomer(customer1.Id);
        var ok1 = Assert.IsType<OkObjectResult>(result1);
        var page1 = Assert.IsType<PagedResult<CustomerActivityItem>>(ok1.Value);

        Assert.Equal(1, page1.TotalCount);
        Assert.Equal("Case for One", page1.Items[0].CaseTitle);

        var result2 = await controller.GetForCustomer(customer2.Id);
        var ok2 = Assert.IsType<OkObjectResult>(result2);
        var page2 = Assert.IsType<PagedResult<CustomerActivityItem>>(ok2.Value);

        Assert.Equal(1, page2.TotalCount);
        Assert.Equal("Case for Two", page2.Items[0].CaseTitle);
    }

    [Fact]
    public async Task GetForCustomer_SupportsPagination()
    {
        var customer = await AddCustomer("Busy Client");
        var casesController = Cases();
        SetActor(casesController, "agent-1");

        for (int i = 1; i <= 5; i++)
        {
            await CreateCase(casesController, customer.Id, $"Case {i}", $"Desc {i}");
        }

        var controller = CustomerActivity();
        var result = await controller.GetForCustomer(customer.Id, page: 2, pageSize: 2);
        var ok = Assert.IsType<OkObjectResult>(result);
        var page = Assert.IsType<PagedResult<CustomerActivityItem>>(ok.Value);

        Assert.Equal(5, page.TotalCount);
        Assert.Equal(2, page.Page);
        Assert.Equal(2, page.PageSize);
        Assert.Equal(2, page.Items.Length);
    }

    private CustomerActivityController CustomerActivity() =>
        new(_database);

    private CasesController Cases() =>
        new(_database, new CaseActivityWriter(_database), TestCsvExport.Service());

    private TasksController Tasks() =>
        new(_database, new CaseActivityWriter(_database), new FixedBusinessClock(new DateOnly(2026, 9, 27)));

    private sealed class FixedBusinessClock(DateOnly today) : IBusinessClock
    {
        public DateOnly Today { get; } = today;
        public string TimeZoneId => "Europe/Copenhagen";
    }

    private async Task<Customer> AddCustomer(string name = "Acme")
    {
        var customer = new Customer
        {
            Name = name,
            Email = $"{name.ToLower().Replace(" ", "")}@example.com",
            CreatedAt = DateTime.UtcNow,
        };
        _database.Customers.Add(customer);
        await _database.SaveChangesAsync();
        return customer;
    }

    private static async Task<Case> CreateCase(CasesController controller, int customerId, string title, string? desc)
    {
        var result = await controller.Create(new Case
        {
            CustomerId = customerId,
            Title = title,
            Description = desc,
        });
        var created = Assert.IsType<CreatedAtActionResult>(result);
        return Assert.IsType<Case>(created.Value);
    }

    private static async Task<CaseTask> CreateTask(TasksController controller, int caseId, string title)
    {
        var result = await controller.Create(new CaseTask
        {
            CaseId = caseId,
            Title = title,
        });
        var created = Assert.IsType<CreatedAtActionResult>(result);
        return Assert.IsType<CaseTask>(created.Value);
    }

    private static void SetActor(ControllerBase controller, string name)
    {
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext
            {
                User = new ClaimsPrincipal(new ClaimsIdentity(
                    new[] { new Claim(ClaimTypes.Name, name) },
                    "Test")),
            },
        };
    }
}
