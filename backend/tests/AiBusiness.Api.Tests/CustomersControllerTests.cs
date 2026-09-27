using AiBusiness.Api.Controllers;
using AiBusiness.Api.Data;
using AiBusiness.Api.Models;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;

namespace AiBusiness.Api.Tests;

// These tests call CustomersController directly against a temporary SQLite database.
// They are not HTTP tests, and they do not use the PostgreSQL development database.
public class CustomersControllerTests : IDisposable
{
    private readonly SqliteConnection _connection;
    private readonly AppDbContext _database;

    public CustomersControllerTests()
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

    private CustomersController CreateController() => new(_database);

    [Fact]
    public async Task Create_ValidCustomer_ReturnsCreatedWithCustomer()
    {
        var controller = CreateController();
        var result = await controller.Create(new Customer
        {
            Name = "Valid Customer",
            Email = "valid@example.com"
        });

        var created = Assert.IsType<CreatedAtActionResult>(result);
        var customer = Assert.IsType<Customer>(created.Value);
        Assert.False(string.IsNullOrWhiteSpace(customer.Name));
        Assert.Equal("valid@example.com", customer.Email);
        Assert.True(customer.Id > 0);
        Assert.Equal(nameof(CustomersController.GetById), created.ActionName);
        Assert.NotNull(created.RouteValues);
        Assert.Equal(customer.Id, Assert.IsType<int>(created.RouteValues["id"]));
    }

    [Fact]
    public async Task Create_ThenGetById_ReturnsSameCustomer()
    {
        var createController = CreateController();
        var createResult = await createController.Create(new Customer
        {
            Name = "Lookup Customer",
            Email = "lookup@example.com"
        });
        var created = Assert.IsType<CreatedAtActionResult>(createResult);
        var saved = Assert.IsType<Customer>(created.Value);

        var getController = CreateController();
        var getResult = await getController.GetById(saved.Id);

        var ok = Assert.IsType<OkObjectResult>(getResult);
        var found = Assert.IsType<Customer>(ok.Value);
        Assert.Equal(saved.Id, found.Id);
        Assert.Equal("Lookup Customer", found.Name);
        Assert.Equal("lookup@example.com", found.Email);
    }

    [Fact]
    public async Task GetById_UnknownId_ReturnsNotFound()
    {
        var controller = CreateController();
        var result = await controller.GetById(int.MaxValue);

        Assert.IsType<NotFoundResult>(result);
    }

    [Fact]
    public async Task Create_BlankName_ReturnsValidationError()
    {
        var uniqueEmail = $"blank-name-{Guid.NewGuid():N}@example.com";
        var controller = CreateController();
        var before = await SnapshotAll(controller);

        var result = await controller.Create(new Customer
        {
            Name = "   ",
            Email = uniqueEmail
        });

        AssertValidationProblem(result, nameof(Customer.Name));
        AssertRejectedNotStored(before, await SnapshotAll(controller), c => c.Email == uniqueEmail);
    }

    [Fact]
    public async Task Create_BlankEmail_ReturnsValidationError()
    {
        var uniqueName = $"blank-email-{Guid.NewGuid():N}";
        var controller = CreateController();
        var before = await SnapshotAll(controller);

        var result = await controller.Create(new Customer
        {
            Name = uniqueName,
            Email = "   "
        });

        AssertValidationProblem(result, nameof(Customer.Email));
        AssertRejectedNotStored(before, await SnapshotAll(controller), c => c.Name == uniqueName);
    }

    [Fact]
    public async Task Create_InvalidEmail_ReturnsValidationError()
    {
        var uniqueName = $"invalid-email-{Guid.NewGuid():N}";
        var controller = CreateController();
        var before = await SnapshotAll(controller);

        var result = await controller.Create(new Customer
        {
            Name = uniqueName,
            Email = "not-an-email"
        });

        AssertValidationProblem(result, nameof(Customer.Email));
        AssertRejectedNotStored(before, await SnapshotAll(controller), c => c.Name == uniqueName);
    }

    [Fact]
    public async Task Create_IgnoresClientProvidedIdAndCreatedAt()
    {
        var submittedAt = new DateTime(2000, 1, 1, 0, 0, 0, DateTimeKind.Utc);
        var controller = CreateController();
        var before = DateTime.UtcNow;

        var result = await controller.Create(new Customer
        {
            Id = 999_999,
            Name = "Override Check",
            Email = "override@example.com",
            CreatedAt = submittedAt
        });

        var after = DateTime.UtcNow;
        var created = Assert.IsType<CreatedAtActionResult>(result);
        var customer = Assert.IsType<Customer>(created.Value);

        Assert.NotEqual(999_999, customer.Id);
        Assert.True(customer.Id > 0);
        Assert.NotEqual(submittedAt, customer.CreatedAt);
        Assert.True(customer.CreatedAt >= before && customer.CreatedAt <= after.AddSeconds(1));
    }

    [Fact]
    public async Task Update_ValidCustomer_ThenGetById_ReturnsUpdated()
    {
        var created = await CreateCustomer("Update Target", "update-target@example.com", "111", "Old Co");
        var originalId = created.Id;
        var originalCreatedAt = created.CreatedAt;

        var updateController = CreateController();
        var updateResult = await updateController.Update(originalId, new Customer
        {
            Name = "Updated Name",
            Email = "updated@example.com",
            Phone = "222",
            Company = "New Co"
        });

        var ok = Assert.IsType<OkObjectResult>(updateResult);
        var updated = Assert.IsType<Customer>(ok.Value);
        Assert.Equal(originalId, updated.Id);
        Assert.Equal(originalCreatedAt, updated.CreatedAt);
        Assert.Equal("Updated Name", updated.Name);
        Assert.Equal("updated@example.com", updated.Email);
        Assert.Equal("222", updated.Phone);
        Assert.Equal("New Co", updated.Company);

        var getController = CreateController();
        var getResult = await getController.GetById(originalId);
        var getOk = Assert.IsType<OkObjectResult>(getResult);
        var found = Assert.IsType<Customer>(getOk.Value);
        Assert.Equal("Updated Name", found.Name);
        Assert.Equal("updated@example.com", found.Email);
        Assert.Equal("222", found.Phone);
        Assert.Equal("New Co", found.Company);
        Assert.Equal(originalId, found.Id);
        Assert.Equal(originalCreatedAt, found.CreatedAt);
    }

    [Fact]
    public async Task Update_PreservesIdAndCreatedAt_DespiteForgedBody()
    {
        var created = await CreateCustomer("Forge Target", "forge@example.com");
        var originalId = created.Id;
        var originalCreatedAt = created.CreatedAt;
        var forgedAt = new DateTime(1999, 6, 15, 0, 0, 0, DateTimeKind.Utc);

        var updateController = CreateController();
        var updateResult = await updateController.Update(originalId, new Customer
        {
            Id = 888_888,
            Name = "Forged Update",
            Email = "forged-update@example.com",
            CreatedAt = forgedAt
        });

        var ok = Assert.IsType<OkObjectResult>(updateResult);
        var updated = Assert.IsType<Customer>(ok.Value);
        Assert.Equal(originalId, updated.Id);
        Assert.Equal(originalCreatedAt, updated.CreatedAt);
        Assert.NotEqual(888_888, updated.Id);
        Assert.NotEqual(forgedAt, updated.CreatedAt);
    }

    [Fact]
    public async Task Update_NullOptionalFields_ClearsOldValues()
    {
        var created = await CreateCustomer("Clear Target", "clear@example.com", "555", "Keep Co");
        var originalId = created.Id;

        var updateController = CreateController();
        var updateResult = await updateController.Update(originalId, new Customer
        {
            Name = "Cleared Optionals",
            Email = "cleared@example.com",
            Phone = null,
            Company = null
        });

        var ok = Assert.IsType<OkObjectResult>(updateResult);
        var updated = Assert.IsType<Customer>(ok.Value);
        Assert.Null(updated.Phone);
        Assert.Null(updated.Company);

        var getController = CreateController();
        var getOk = Assert.IsType<OkObjectResult>(await getController.GetById(originalId));
        var found = Assert.IsType<Customer>(getOk.Value);
        Assert.Null(found.Phone);
        Assert.Null(found.Company);
    }

    [Fact]
    public async Task Update_UnknownId_ReturnsNotFound()
    {
        var controller = CreateController();
        var result = await controller.Update(int.MaxValue, new Customer
        {
            Name = "Missing",
            Email = "missing@example.com"
        });

        Assert.IsType<NotFoundResult>(result);
    }

    [Fact]
    public async Task Update_BlankName_ReturnsValidationError_DoesNotChange()
    {
        var created = await CreateCustomer("Keep Name", "keep-name@example.com", "p1", "c1");
        await AssertFieldsUnchangedAfterInvalidUpdate(
            created,
            new Customer { Name = "   ", Email = "keep-name@example.com", Phone = "changed", Company = "changed" },
            nameof(Customer.Name));
    }

    [Fact]
    public async Task Update_BlankEmail_ReturnsValidationError_DoesNotChange()
    {
        var created = await CreateCustomer("Keep Email Blank", "keep-blank-email@example.com", "p2", "c2");
        await AssertFieldsUnchangedAfterInvalidUpdate(
            created,
            new Customer { Name = "Changed", Email = "   ", Phone = "changed", Company = "changed" },
            nameof(Customer.Email));
    }

    [Fact]
    public async Task Update_InvalidEmail_ReturnsValidationError_DoesNotChange()
    {
        var created = await CreateCustomer("Keep Email Bad", "keep-bad-email@example.com", "p3", "c3");
        await AssertFieldsUnchangedAfterInvalidUpdate(
            created,
            new Customer { Name = "Changed", Email = "not-an-email", Phone = "changed", Company = "changed" },
            nameof(Customer.Email));
    }

    [Fact]
    public async Task Update_DoesNotChangeUnrelatedCustomer()
    {
        var target = await CreateCustomer("Target Customer", "target-unrelated@example.com", "t-phone", "t-co");
        var other = await CreateCustomer("Other Customer", "other-unrelated@example.com", "o-phone", "o-co");
        var otherId = other.Id;
        var otherName = other.Name;
        var otherEmail = other.Email;
        var otherPhone = other.Phone;
        var otherCompany = other.Company;
        var otherCreatedAt = other.CreatedAt;

        var updateController = CreateController();
        var updateResult = await updateController.Update(target.Id, new Customer
        {
            Name = "Target Updated",
            Email = "target-updated@example.com",
            Phone = "new-phone",
            Company = "new-co"
        });
        Assert.IsType<OkObjectResult>(updateResult);

        var getController = CreateController();
        var getOk = Assert.IsType<OkObjectResult>(await getController.GetById(otherId));
        var foundOther = Assert.IsType<Customer>(getOk.Value);
        Assert.Equal(otherId, foundOther.Id);
        Assert.Equal(otherName, foundOther.Name);
        Assert.Equal(otherEmail, foundOther.Email);
        Assert.Equal(otherPhone, foundOther.Phone);
        Assert.Equal(otherCompany, foundOther.Company);
        Assert.Equal(otherCreatedAt, foundOther.CreatedAt);
    }

    [Fact]
    public async Task Delete_ExistingCustomer_ReturnsNoContent_ThenGetByIdNotFound()
    {
        var created = await CreateCustomer("Delete Target", "delete-target@example.com");
        var id = created.Id;

        var deleteController = CreateController();
        var deleteResult = await deleteController.Delete(id);
        Assert.IsType<NoContentResult>(deleteResult);

        var getController = CreateController();
        Assert.IsType<NotFoundResult>(await getController.GetById(id));
    }

    [Fact]
    public async Task Delete_RemovesFromGetAll_UnrelatedCustomerUnchanged()
    {
        var target = await CreateCustomer("Delete From List", "delete-from-list@example.com");
        var other = await CreateCustomer("Keep After Delete", "keep-after-delete@example.com", "keep-phone", "keep-co");
        var otherId = other.Id;
        var otherName = other.Name;
        var otherEmail = other.Email;
        var otherPhone = other.Phone;
        var otherCompany = other.Company;
        var otherCreatedAt = other.CreatedAt;

        var deleteController = CreateController();
        Assert.IsType<NoContentResult>(await deleteController.Delete(target.Id));

        var getController = CreateController();
        var all = await SnapshotAll(getController);
        Assert.DoesNotContain(all, c => c.Id == target.Id);

        var getOk = Assert.IsType<OkObjectResult>(await getController.GetById(otherId));
        var foundOther = Assert.IsType<Customer>(getOk.Value);
        Assert.Equal(otherId, foundOther.Id);
        Assert.Equal(otherName, foundOther.Name);
        Assert.Equal(otherEmail, foundOther.Email);
        Assert.Equal(otherPhone, foundOther.Phone);
        Assert.Equal(otherCompany, foundOther.Company);
        Assert.Equal(otherCreatedAt, foundOther.CreatedAt);
    }

    [Fact]
    public async Task Delete_CustomerWithCases_ReturnsConflict_AndKeepsCustomerAndCase()
    {
        var created = await CreateCustomer("Has Case", "has-case@example.com");
        var createdAt = created.CreatedAt;
        _database.Cases.Add(new Case
        {
            CustomerId = created.Id,
            Title = "Booking page",
            Description = "A booking page",
            Status = CaseStatus.InProgress,
        });
        await _database.SaveChangesAsync();
        _database.ChangeTracker.Clear();

        var result = await CreateController().Delete(created.Id);

        var conflict = Assert.IsType<ObjectResult>(result);
        Assert.Equal(StatusCodes.Status409Conflict, conflict.StatusCode);
        var problem = Assert.IsType<ProblemDetails>(conflict.Value);
        Assert.Equal("This customer has cases and cannot be deleted.", problem.Detail);

        var storedCustomer = await _database.Customers.AsNoTracking()
            .SingleAsync(customer => customer.Id == created.Id);
        Assert.Equal("Has Case", storedCustomer.Name);
        Assert.Equal("has-case@example.com", storedCustomer.Email);
        Assert.Equal(createdAt, storedCustomer.CreatedAt);

        var storedCase = await _database.Cases.AsNoTracking().SingleAsync();
        Assert.Equal(created.Id, storedCase.CustomerId);
        Assert.Equal("Booking page", storedCase.Title);
        Assert.Equal("A booking page", storedCase.Description);
        Assert.Equal(CaseStatus.InProgress, storedCase.Status);
    }

    [Fact]
    public async Task Delete_UnknownId_ReturnsNotFound_DoesNotChangeList()
    {
        var controller = CreateController();
        var before = await SnapshotAll(controller);

        var result = await controller.Delete(int.MaxValue);
        Assert.IsType<NotFoundResult>(result);

        var after = await SnapshotAll(controller);
        Assert.Equal(before.Select(c => c.Id), after.Select(c => c.Id));
    }

    [Fact]
    public async Task Delete_SameIdTwice_SecondReturnsNotFound()
    {
        var created = await CreateCustomer("Delete Twice", "delete-twice@example.com");
        var id = created.Id;

        var deleteController = CreateController();
        Assert.IsType<NoContentResult>(await deleteController.Delete(id));
        Assert.IsType<NotFoundResult>(await deleteController.Delete(id));
    }

    private async Task<Customer> CreateCustomer(
        string name,
        string email,
        string? phone = null,
        string? company = null)
    {
        var controller = CreateController();
        var result = await controller.Create(new Customer
        {
            Name = name,
            Email = email,
            Phone = phone,
            Company = company
        });
        var created = Assert.IsType<CreatedAtActionResult>(result);
        return Assert.IsType<Customer>(created.Value);
    }

    private async Task AssertFieldsUnchangedAfterInvalidUpdate(
        Customer created,
        Customer invalidBody,
        string expectedField)
    {
        var id = created.Id;
        var name = created.Name;
        var email = created.Email;
        var phone = created.Phone;
        var company = created.Company;
        var createdAt = created.CreatedAt;

        var updateController = CreateController();
        var result = await updateController.Update(id, invalidBody);
        AssertValidationProblem(result, expectedField);

        var getController = CreateController();
        var getOk = Assert.IsType<OkObjectResult>(await getController.GetById(id));
        var found = Assert.IsType<Customer>(getOk.Value);
        Assert.Equal(id, found.Id);
        Assert.Equal(name, found.Name);
        Assert.Equal(email, found.Email);
        Assert.Equal(phone, found.Phone);
        Assert.Equal(company, found.Company);
        Assert.Equal(createdAt, found.CreatedAt);
    }

    [Fact]
    public async Task GetAll_Search_MatchesNameEmailOrCompany_CaseInsensitive()
    {
        await CreateStored("Alpha Desk", "alpha@example.com", null, "North Studio");
        var byEmail = await CreateStored("Beta Desk", "needle-email@example.com", null, null);
        var byCompany = await CreateStored("Gamma Desk", "gamma@example.com", null, "Needle Co");
        var byName = await CreateStored("Needle Name", "name@example.com", null, null);

        var matches = await ListCustomers("NeEdLe");
        Assert.Equal(
            new[] { byEmail.Id, byCompany.Id, byName.Id },
            matches.Select(c => c.Id).OrderBy(id => id).ToArray());
        Assert.DoesNotContain(matches, c => c.Name == "Alpha Desk");
    }

    [Fact]
    public async Task GetAll_Search_TrimsWhitespace_BlankMeansNoFilter()
    {
        var first = await CreateStored("Keep A", "keep-a@example.com", null, null);
        var second = await CreateStored("Keep B", "keep-b@example.com", null, null);

        var blank = await ListCustomers("   ");
        Assert.Equal(new[] { first.Id, second.Id }, blank.Select(c => c.Id));

        var trimmed = await ListCustomers("  Keep A  ");
        var only = Assert.Single(trimmed);
        Assert.Equal(first.Id, only.Id);
    }

    [Fact]
    public async Task GetAll_Search_TreatsSpecialCharactersLiterally()
    {
        var literal = await CreateStored("Percent %_ Co", "percent@example.com", null, "100% literal");
        await CreateStored("Other", "other-search@example.com", null, "plain");

        var byName = await ListCustomers("%_");
        var onlyName = Assert.Single(byName);
        Assert.Equal(literal.Id, onlyName.Id);

        var byCompany = await ListCustomers("100%");
        var onlyCompany = Assert.Single(byCompany);
        Assert.Equal(literal.Id, onlyCompany.Id);
    }

    [Fact]
    public async Task GetAll_Search_EmptyWhenNoneMatch_PreservesOrderingWithoutSearch()
    {
        var first = await CreateStored("Order One", "order1@example.com", null, null);
        var second = await CreateStored("Order Two", "order2@example.com", null, null);

        Assert.Empty(await ListCustomers("zzz-no-match"));

        var all = await ListCustomers(null);
        Assert.Equal(new[] { first.Id, second.Id }, all.Select(c => c.Id));
        Assert.All(all, c =>
        {
            Assert.False(string.IsNullOrWhiteSpace(c.Name));
            Assert.False(string.IsNullOrWhiteSpace(c.Email));
            Assert.True(c.Id > 0);
        });
    }

    [Fact]
    public async Task GetAll_WithoutPagination_StillReturnsArray()
    {
        var first = await CreateStored("Array One", "array1@example.com", null, null);
        var second = await CreateStored("Array Two", "array2@example.com", null, null);

        var ok = Assert.IsType<OkObjectResult>(await CreateController().GetAll());
        var customers = Assert.IsType<Customer[]>(ok.Value);
        Assert.Equal(new[] { first.Id, second.Id }, customers.Select(c => c.Id));
    }

    [Fact]
    public async Task GetAll_Pagination_ReturnsPageMetadata_AndSlicesItems()
    {
        for (var index = 1; index <= 5; index++)
        {
            await CreateStored($"Page Cust {index}", $"page-cust-{index}@example.com", null, null);
        }

        var first = await PageCustomers(page: 1, pageSize: 2);
        Assert.Equal(1, first.Page);
        Assert.Equal(2, first.PageSize);
        Assert.Equal(5, first.TotalCount);
        Assert.Equal(2, first.Items.Length);
        Assert.Equal(
            new[] { "Page Cust 1", "Page Cust 2" },
            first.Items.Select(c => c.Name).ToArray());

        var second = await PageCustomers(page: 2, pageSize: 2);
        Assert.Equal(new[] { "Page Cust 3", "Page Cust 4" }, second.Items.Select(c => c.Name).ToArray());

        var third = await PageCustomers(page: 3, pageSize: 2);
        Assert.Equal(new[] { "Page Cust 5" }, third.Items.Select(c => c.Name).ToArray());
    }

    [Fact]
    public async Task GetAll_Pagination_DefaultsPageAndPageSize_WhenOneProvided()
    {
        for (var index = 1; index <= 21; index++)
        {
            await CreateStored($"Default {index}", $"default-{index}@example.com", null, null);
        }

        var byPageOnly = await PageCustomers(page: 1, pageSize: null);
        Assert.Equal(1, byPageOnly.Page);
        Assert.Equal(20, byPageOnly.PageSize);
        Assert.Equal(21, byPageOnly.TotalCount);
        Assert.Equal(20, byPageOnly.Items.Length);

        var bySizeOnly = await PageCustomers(page: null, pageSize: 5);
        Assert.Equal(1, bySizeOnly.Page);
        Assert.Equal(5, bySizeOnly.PageSize);
        Assert.Equal(5, bySizeOnly.Items.Length);
    }

    [Fact]
    public async Task GetAll_Pagination_OutOfRangePage_ReturnsEmptyItems_WithTotalCount()
    {
        await CreateStored("Only One", "only-one@example.com", null, null);

        var page = await PageCustomers(page: 9, pageSize: 20);
        Assert.Empty(page.Items);
        Assert.Equal(1, page.TotalCount);
        Assert.Equal(9, page.Page);
        Assert.Equal(20, page.PageSize);
    }

    [Fact]
    public async Task GetAll_Pagination_AppliesSearchBeforeCountAndSlice()
    {
        await CreateStored("Other", "other-page@example.com", null, null);
        await CreateStored("Needle A", "needle-a@example.com", null, null);
        await CreateStored("Needle B", "needle-b@example.com", null, null);
        await CreateStored("Needle C", "needle-c@example.com", null, null);

        var page = await PageCustomers(page: 1, pageSize: 2, search: "Needle");
        Assert.Equal(3, page.TotalCount);
        Assert.Equal(new[] { "Needle A", "Needle B" }, page.Items.Select(c => c.Name).ToArray());
    }

    [Fact]
    public async Task GetAll_Pagination_InvalidValues_ReturnValidationErrors()
    {
        AssertValidationProblem(
            await CreateController().GetAll(page: 0, pageSize: 20),
            "page");
        AssertValidationProblem(
            await CreateController().GetAll(page: 1, pageSize: 0),
            "pageSize");
        AssertValidationProblem(
            await CreateController().GetAll(page: 1, pageSize: 101),
            "pageSize");
    }

    private async Task<Customer> CreateStored(
        string name,
        string email,
        string? phone,
        string? company)
    {
        var result = await CreateController().Create(new Customer
        {
            Name = name,
            Email = email,
            Phone = phone,
            Company = company,
        });
        var created = Assert.IsType<CreatedAtActionResult>(result);
        return Assert.IsType<Customer>(created.Value);
    }

    private async Task<Customer[]> ListCustomers(string? search)
    {
        var ok = Assert.IsType<OkObjectResult>(await CreateController().GetAll(search));
        return Assert.IsType<Customer[]>(ok.Value);
    }

    private async Task<PagedResult<Customer>> PageCustomers(
        int? page,
        int? pageSize,
        string? search = null)
    {
        var ok = Assert.IsType<OkObjectResult>(
            await CreateController().GetAll(search, page, pageSize));
        return Assert.IsType<PagedResult<Customer>>(ok.Value);
    }

    private static async Task<Customer[]> SnapshotAll(CustomersController controller)
    {
        var ok = Assert.IsType<OkObjectResult>(await controller.GetAll(null));
        return Assert.IsType<Customer[]>(ok.Value);
    }

    private static void AssertValidationProblem(IActionResult result, string expectedField)
    {
        var objectResult = Assert.IsAssignableFrom<ObjectResult>(result);
        var problem = Assert.IsType<ValidationProblemDetails>(objectResult.Value);
        Assert.True(problem.Errors.ContainsKey(expectedField), $"Expected error for '{expectedField}'.");
        Assert.NotEmpty(problem.Errors[expectedField]);
    }

    private static void AssertRejectedNotStored(
        Customer[] before,
        Customer[] after,
        Predicate<Customer> matchesAttempt)
    {
        Assert.Equal(before.Select(c => c.Id), after.Select(c => c.Id));
        Assert.DoesNotContain(after, matchesAttempt);
    }
}
