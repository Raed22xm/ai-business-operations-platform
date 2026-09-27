using AiBusiness.Api.Data;
using AiBusiness.Api.Models;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;

namespace AiBusiness.Api.Tests;

public class CaseStorageTests : IDisposable
{
    private readonly SqliteConnection _connection;
    private readonly AppDbContext _database;

    public CaseStorageTests()
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
    public async Task Save_SetsUtcCreatedAt_AndUpdateKeepsIt()
    {
        var customer = await AddCustomer();
        var sentCreatedAt = new DateTime(2000, 1, 1, 0, 0, 0, DateTimeKind.Utc);
        var work = new Case
        {
            CustomerId = customer.Id,
            Title = "Booking page",
            CreatedAt = sentCreatedAt,
        };

        _database.Cases.Add(work);
        await _database.SaveChangesAsync();

        Assert.Equal(CaseStatus.Open, work.Status);
        Assert.Equal(DateTimeKind.Utc, work.CreatedAt.Kind);
        Assert.NotEqual(sentCreatedAt, work.CreatedAt);
        var createdAt = work.CreatedAt;

        work.Title = "Updated booking page";
        work.CreatedAt = createdAt.AddDays(3);
        await _database.SaveChangesAsync();

        var stored = await _database.Cases.AsNoTracking().SingleAsync();
        Assert.Equal("Updated booking page", stored.Title);
        Assert.Equal(createdAt, stored.CreatedAt);
        Assert.Equal(createdAt, work.CreatedAt);
    }

    [Fact]
    public async Task DeleteCustomer_WithCase_IsRejectedAndCustomerRemains()
    {
        var customer = await AddCustomer();
        _database.Cases.Add(new Case { CustomerId = customer.Id, Title = "Booking page" });
        await _database.SaveChangesAsync();
        _database.ChangeTracker.Clear();

        var storedCustomer = await _database.Customers.SingleAsync(c => c.Id == customer.Id);
        _database.Customers.Remove(storedCustomer);
        await Assert.ThrowsAsync<DbUpdateException>(() => _database.SaveChangesAsync());

        Assert.NotNull(await _database.Customers.AsNoTracking().SingleOrDefaultAsync(c => c.Id == customer.Id));
        Assert.Equal(1, await _database.Cases.AsNoTracking().CountAsync());
    }

    [Fact]
    public async Task DeleteCase_WithTask_IsRejectedAndCaseRemains()
    {
        var customer = await AddCustomer();
        var work = new Case { CustomerId = customer.Id, Title = "Booking page" };
        _database.Cases.Add(work);
        await _database.SaveChangesAsync();
        _database.CaseTasks.Add(new CaseTask { CaseId = work.Id, Title = "Design page" });
        await _database.SaveChangesAsync();
        _database.ChangeTracker.Clear();

        var storedCase = await _database.Cases.SingleAsync(c => c.Id == work.Id);
        _database.Cases.Remove(storedCase);
        await Assert.ThrowsAsync<DbUpdateException>(() => _database.SaveChangesAsync());

        Assert.NotNull(await _database.Cases.AsNoTracking().SingleOrDefaultAsync(c => c.Id == work.Id));
        Assert.Equal(1, await _database.CaseTasks.AsNoTracking().CountAsync());
    }

    [Fact]
    public async Task Save_UnknownCustomer_IsRejected()
    {
        _database.Cases.Add(new Case { CustomerId = 999, Title = "Missing customer" });

        await Assert.ThrowsAsync<DbUpdateException>(() => _database.SaveChangesAsync());
        Assert.Equal(0, await _database.Cases.AsNoTracking().CountAsync());
    }

    private async Task<Customer> AddCustomer()
    {
        var customer = new Customer
        {
            Name = "Studio 22",
            Email = "studio22@example.com",
            CreatedAt = DateTime.UtcNow,
        };
        _database.Customers.Add(customer);
        await _database.SaveChangesAsync();
        return customer;
    }
}
