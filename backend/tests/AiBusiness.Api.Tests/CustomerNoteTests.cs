using System.Security.Claims;
using AiBusiness.Api.Controllers;
using AiBusiness.Api.Data;
using AiBusiness.Api.Models;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;

namespace AiBusiness.Api.Tests;

public class CustomerNoteTests : IDisposable
{
    private readonly SqliteConnection _connection;
    private readonly AppDbContext _database;

    public CustomerNoteTests()
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
    public async Task Create_SetsAuthorTimestamps_IgnoresClientProtectedFields()
    {
        var customer = await AddCustomer();
        var notes = Notes();
        SetActor(notes, "workspace-user");

        var before = DateTime.UtcNow.AddSeconds(-2);
        var result = await notes.Create(customer.Id, new CustomerNote
        {
            Id = 99,
            CustomerId = 0,
            Content = "  Follow up next week  ",
            AuthorName = "spoofed",
            CreatedAt = DateTime.UtcNow.AddYears(-1),
            UpdatedAt = DateTime.UtcNow.AddYears(-1),
        });
        var after = DateTime.UtcNow.AddSeconds(2);

        var created = Assert.IsType<CreatedAtActionResult>(result);
        var note = Assert.IsType<CustomerNote>(created.Value);
        Assert.True(note.Id > 0);
        Assert.NotEqual(99, note.Id);
        Assert.Equal(customer.Id, note.CustomerId);
        Assert.Equal("Follow up next week", note.Content);
        Assert.Equal("workspace-user", note.AuthorName);
        Assert.Null(note.UpdatedAt);
        Assert.Equal(DateTimeKind.Utc, note.CreatedAt.Kind);
        Assert.InRange(note.CreatedAt, before, after);
    }

    [Fact]
    public async Task Create_BlankOrTooLong_Returns400()
    {
        var customer = await AddCustomer();
        var notes = Notes();
        SetActor(notes, "workspace-user");

        AssertValidationProblem(
            await notes.Create(customer.Id, new CustomerNote { Content = "   " }),
            nameof(CustomerNote.Content));
        AssertValidationProblem(
            await notes.Create(customer.Id, new CustomerNote { Content = new string('a', 5001) }),
            nameof(CustomerNote.Content));
        Assert.Equal(0, await _database.CustomerNotes.CountAsync());
    }

    [Fact]
    public async Task Create_MissingCustomer_Returns404()
    {
        var notes = Notes();
        SetActor(notes, "workspace-user");
        Assert.IsType<NotFoundResult>(
            await notes.Create(404, new CustomerNote { Content = "Orphan" }));
    }

    [Fact]
    public async Task List_NewestFirst_WithStablePagination()
    {
        var customer = await AddCustomer();
        var notes = Notes();
        SetActor(notes, "alice");
        for (var i = 1; i <= 3; i++)
        {
            await notes.Create(customer.Id, new CustomerNote { Content = $"Note {i}" });
        }

        var page1 = await List(customer.Id, page: 1, pageSize: 2);
        Assert.Equal(3, page1.TotalCount);
        Assert.Equal(2, page1.Items.Length);
        Assert.Equal("Note 3", page1.Items[0].Content);
        Assert.Equal("Note 2", page1.Items[1].Content);
        Assert.True(page1.Items[0].CreatedAt >= page1.Items[1].CreatedAt);
        Assert.True(page1.Items[0].Id > page1.Items[1].Id);

        var page2 = await List(customer.Id, page: 2, pageSize: 2);
        Assert.Single(page2.Items);
        Assert.Equal("Note 1", page2.Items[0].Content);
    }

    [Fact]
    public async Task Update_PreservesAuthorAndCreatedAt_SetsUpdatedAt()
    {
        var customer = await AddCustomer();
        var notes = Notes();
        SetActor(notes, "alice");
        var created = Assert.IsType<CustomerNote>(
            Assert.IsType<CreatedAtActionResult>(
                await notes.Create(customer.Id, new CustomerNote { Content = "Original" })).Value);

        SetActor(notes, "bob");
        var result = await notes.Update(customer.Id, created.Id, new CustomerNote
        {
            Content = "Edited",
            AuthorName = "intruder",
            CreatedAt = DateTime.UtcNow.AddYears(-5),
            UpdatedAt = null,
        });

        var updated = Assert.IsType<CustomerNote>(Assert.IsType<OkObjectResult>(result).Value);
        Assert.Equal("Edited", updated.Content);
        Assert.Equal("alice", updated.AuthorName);
        Assert.Equal(created.CreatedAt, updated.CreatedAt);
        Assert.NotNull(updated.UpdatedAt);
        Assert.Equal(DateTimeKind.Utc, updated.UpdatedAt!.Value.Kind);
    }

    [Fact]
    public async Task Update_WrongCustomerOrMissing_Returns404()
    {
        var one = await AddCustomer("One");
        var two = await AddCustomer("Two");
        var notes = Notes();
        SetActor(notes, "alice");
        var created = Assert.IsType<CustomerNote>(
            Assert.IsType<CreatedAtActionResult>(
                await notes.Create(one.Id, new CustomerNote { Content = "Scoped" })).Value);

        Assert.IsType<NotFoundResult>(
            await notes.Update(two.Id, created.Id, new CustomerNote { Content = "Nope" }));
        Assert.IsType<NotFoundResult>(
            await notes.Update(one.Id, 999, new CustomerNote { Content = "Nope" }));
        Assert.Equal("Scoped", (await _database.CustomerNotes.FindAsync(created.Id))!.Content);
    }

    [Fact]
    public async Task Delete_RemovesNote_Only()
    {
        var customer = await AddCustomer();
        var notes = Notes();
        SetActor(notes, "alice");
        var created = Assert.IsType<CustomerNote>(
            Assert.IsType<CreatedAtActionResult>(
                await notes.Create(customer.Id, new CustomerNote { Content = "Temp" })).Value);

        Assert.IsType<NoContentResult>(await notes.Delete(customer.Id, created.Id));
        Assert.Null(await _database.CustomerNotes.FindAsync(created.Id));
        Assert.NotNull(await _database.Customers.FindAsync(customer.Id));
    }

    [Fact]
    public async Task DeleteCustomer_CascadesNotes()
    {
        var customer = await AddCustomer();
        var notes = Notes();
        SetActor(notes, "alice");
        await notes.Create(customer.Id, new CustomerNote { Content = "Will go with customer" });
        Assert.Equal(1, await _database.CustomerNotes.CountAsync());

        var customers = new CustomersController(_database, TestCsvExport.Service());
        Assert.IsType<NoContentResult>(await customers.Delete(customer.Id));
        Assert.Equal(0, await _database.CustomerNotes.CountAsync());
    }

    private CustomerNotesController Notes() => new(_database);

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

    private async Task<Customer> AddCustomer(string name = "Notes Customer")
    {
        var customer = new Customer
        {
            Name = name,
            Email = $"{Guid.NewGuid():N}@example.com",
        };
        _database.Customers.Add(customer);
        await _database.SaveChangesAsync();
        return customer;
    }

    private async Task<PagedResult<CustomerNote>> List(int customerId, int page, int pageSize)
    {
        var result = await Notes().GetForCustomer(customerId, page, pageSize);
        return Assert.IsType<PagedResult<CustomerNote>>(
            Assert.IsType<OkObjectResult>(result).Value);
    }

    private static void AssertValidationProblem(IActionResult result, string expectedField)
    {
        var objectResult = Assert.IsAssignableFrom<ObjectResult>(result);
        var problem = Assert.IsType<ValidationProblemDetails>(objectResult.Value);
        Assert.True(problem.Errors.ContainsKey(expectedField), $"Expected error for '{expectedField}'.");
        Assert.NotEmpty(problem.Errors[expectedField]);
    }
}
