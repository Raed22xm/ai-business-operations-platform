using AiBusiness.Api.Controllers;
using AiBusiness.Api.Data;
using AiBusiness.Api.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;

namespace AiBusiness.Api.Tests;

public class DashboardControllerTests : IDisposable
{
    private readonly SqliteConnection _connection;
    private readonly AppDbContext _database;

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
        Assert.IsType<NoContentResult>(await new CasesController(_database).Delete(toDelete.Id));

        var after = await GetSummary();
        Assert.Equal(1, after.TotalCustomers);
        Assert.Equal(2, after.TotalCases);
        Assert.Equal(1, after.OpenCases);
        Assert.Equal(0, after.InProgressCases);
        Assert.Equal(1, after.ClosedCases);
        Assert.Equal(keepOpen.Id, (await ListCaseIds()).Single(id => id == keepOpen.Id));
    }

    private async Task<DashboardSummary> GetSummary()
    {
        var result = await new DashboardController(_database).GetSummary();
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
        var result = await new CasesController(_database).Create(new Case
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
        var result = await new CasesController(_database).Update(id, new CaseUpdate
        {
            Title = title,
            Description = description,
            Status = status,
        });
        var ok = Assert.IsType<OkObjectResult>(result);
        return Assert.IsType<Case>(ok.Value);
    }

    private async Task<int[]> ListCaseIds()
    {
        var result = await new CasesController(_database).GetAll();
        var ok = Assert.IsType<OkObjectResult>(result);
        return Assert.IsType<Case[]>(ok.Value).Select(work => work.Id).ToArray();
    }
}
