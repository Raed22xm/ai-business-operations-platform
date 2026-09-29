using System.Text;
using AiBusiness.Api.Controllers;
using AiBusiness.Api.Data;
using AiBusiness.Api.Models;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;

namespace AiBusiness.Api.Tests;

public class CasesControllerTests : IDisposable
{
    private readonly SqliteConnection _connection;
    private readonly AppDbContext _database;

    public CasesControllerTests()
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
    public async Task Create_ValidCase_ReturnsCreatedOpenCase()
    {
        var customer = await AddCustomer();
        var controller = CreateController();

        var created = await CreateCase(controller, customer.Id, "  Booking page  ", "  A booking page  ");

        Assert.True(created.Id > 0);
        Assert.Equal(customer.Id, created.CustomerId);
        Assert.Equal("Booking page", created.Title);
        Assert.Equal("A booking page", created.Description);
        Assert.Equal(CaseStatus.Open, created.Status);
        Assert.Equal(DateTimeKind.Utc, created.CreatedAt.Kind);
        Assert.NotEqual(default, created.CreatedAt);
    }

    [Fact]
    public async Task Create_TitleOf200Characters_ReturnsCreated()
    {
        var customer = await AddCustomer();
        var title = new string('a', 200);

        var created = await CreateCase(CreateController(), customer.Id, title, null);

        Assert.Equal(title, created.Title);
        Assert.Null(created.Description);
    }

    [Fact]
    public async Task Create_IgnoresSubmittedIdStatusAndCreatedAt()
    {
        var customer = await AddCustomer();
        var submittedCreatedAt = new DateTime(2000, 1, 1, 0, 0, 0, DateTimeKind.Utc);
        var controller = CreateController();
        var result = await controller.Create(new Case
        {
            Id = 99,
            CustomerId = customer.Id,
            Title = "Booking page",
            Status = CaseStatus.Closed,
            CreatedAt = submittedCreatedAt,
        });

        var createdResult = Assert.IsType<CreatedAtActionResult>(result);
        Assert.Equal(nameof(CasesController.GetById), createdResult.ActionName);
        Assert.NotNull(createdResult.RouteValues);
        var created = Assert.IsType<Case>(createdResult.Value);
        Assert.NotEqual(99, created.Id);
        Assert.Equal(created.Id, Assert.IsType<int>(createdResult.RouteValues["id"]));
        Assert.Equal(CaseStatus.Open, created.Status);
        Assert.NotEqual(submittedCreatedAt, created.CreatedAt);
    }

    [Fact]
    public async Task Create_ThenGetById_ReturnsSavedFields()
    {
        var customer = await AddCustomer();
        var created = await CreateCase(CreateController(), customer.Id, "Booking page", "A booking page");

        var getResult = await CreateController().GetById(created.Id);

        var ok = Assert.IsType<OkObjectResult>(getResult);
        var found = Assert.IsType<Case>(ok.Value);
        Assert.Equal(created.Id, found.Id);
        Assert.Equal(customer.Id, found.CustomerId);
        Assert.Equal("Booking page", found.Title);
        Assert.Equal("A booking page", found.Description);
        Assert.Equal(CaseStatus.Open, found.Status);
        Assert.Equal(created.CreatedAt, found.CreatedAt);
    }

    [Fact]
    public async Task GetById_UnknownId_ReturnsNotFound()
    {
        var result = await CreateController().GetById(int.MaxValue);

        Assert.IsType<NotFoundResult>(result);
    }

    [Fact]
    public async Task Create_BlankTitle_ReturnsValidationErrorAndStoresNothing()
    {
        var customer = await AddCustomer();

        var result = await CreateController().Create(new Case
        {
            CustomerId = customer.Id,
            Title = "   ",
        });

        AssertValidationProblem(result, nameof(Case.Title), "Title is required.");
        Assert.Equal(0, await _database.Cases.CountAsync());
    }

    [Fact]
    public async Task Create_TitleTooLong_ReturnsValidationErrorAndStoresNothing()
    {
        var customer = await AddCustomer();

        var result = await CreateController().Create(new Case
        {
            CustomerId = customer.Id,
            Title = new string('a', 201),
        });

        AssertValidationProblem(result, nameof(Case.Title), "Title must be at most 200 characters.");
        Assert.Equal(0, await _database.Cases.CountAsync());
    }

    [Fact]
    public async Task Create_MissingCustomer_ReturnsValidationErrorAndStoresNothing()
    {
        var missing = await CreateController().Create(new Case
        {
            CustomerId = 0,
            Title = "Booking page",
        });
        AssertValidationProblem(missing, nameof(Case.CustomerId), "Customer is required.");

        var unknown = await CreateController().Create(new Case
        {
            CustomerId = 999,
            Title = "Booking page",
        });
        AssertValidationProblem(unknown, nameof(Case.CustomerId), "Customer was not found.");
        Assert.Equal(0, await _database.Cases.CountAsync());
    }

    [Fact]
    public async Task GetAll_WhenEmpty_ReturnsEmptyArray()
    {
        var cases = await ListCases();

        Assert.Empty(cases);
    }

    [Fact]
    public async Task GetAll_ReturnsSavedFields()
    {
        var customer = await AddCustomer();
        var created = await CreateCase(CreateController(), customer.Id, "Booking page", "A booking page");

        var found = Assert.Single(await ListCases());

        Assert.Equal(created.Id, found.Id);
        Assert.Equal(customer.Id, found.CustomerId);
        Assert.Equal("Booking page", found.Title);
        Assert.Equal("A booking page", found.Description);
        Assert.Equal(CaseStatus.Open, found.Status);
        Assert.Equal(created.CreatedAt, found.CreatedAt);
    }

    [Fact]
    public async Task GetAll_OrdersNewestFirst_ThenHighestId()
    {
        var customer = await AddCustomer();
        var first = await CreateCase(CreateController(), customer.Id, "First", null);
        var second = await CreateCase(CreateController(), customer.Id, "Second", null);
        var sameTime = new DateTime(2026, 1, 2, 3, 4, 5, DateTimeKind.Utc);
        await SetCreatedAt(first.Id, sameTime);
        await SetCreatedAt(second.Id, sameTime);
        var third = await CreateCase(CreateController(), customer.Id, "Third", "Later");
        await SetCreatedAt(third.Id, sameTime.AddMinutes(1));

        var cases = await ListCases();

        Assert.Equal(new[] { third.Id, second.Id, first.Id }, cases.Select(work => work.Id));
    }

    [Fact]
    public async Task GetAll_FiltersByCustomerId_AndEmptyWhenNoneMatch()
    {
        var first = await AddCustomer();
        var second = await AddCustomer("Other Studio", "other@example.com");
        var third = await AddCustomer("No Cases", "none@example.com");
        var kept = await CreateCase(CreateController(), first.Id, "Kept", "Details");
        await CreateCase(CreateController(), second.Id, "Other", null);

        var filtered = await ListCases(first.Id);
        var only = Assert.Single(filtered);
        Assert.Equal(kept.Id, only.Id);
        Assert.Equal(first.Id, only.CustomerId);

        Assert.Empty(await ListCases(third.Id));
    }

    [Fact]
    public async Task GetAll_FiltersByStatus()
    {
        var customer = await AddCustomer();
        var openCase = await CreateCase(CreateController(), customer.Id, "Open case", null);
        var progress = await CreateCase(CreateController(), customer.Id, "Progress case", null);
        var closed = await CreateCase(CreateController(), customer.Id, "Closed case", null);
        await UpdateCase(progress.Id, "Progress case", null, nameof(CaseStatus.InProgress));
        await UpdateCase(closed.Id, "Closed case", null, nameof(CaseStatus.Closed));

        var openOnly = await ListCases(status: nameof(CaseStatus.Open));
        Assert.Equal(new[] { openCase.Id }, openOnly.Select(work => work.Id));

        var progressOnly = await ListCases(status: nameof(CaseStatus.InProgress));
        Assert.Equal(new[] { progress.Id }, progressOnly.Select(work => work.Id));

        var closedOnly = await ListCases(status: nameof(CaseStatus.Closed));
        Assert.Equal(new[] { closed.Id }, closedOnly.Select(work => work.Id));
    }

    [Fact]
    public async Task GetAll_CombinesCustomerIdAndStatus()
    {
        var first = await AddCustomer();
        var second = await AddCustomer("Other Studio", "other-status@example.com");
        var kept = await CreateCase(CreateController(), first.Id, "Kept open", null);
        var otherOpen = await CreateCase(CreateController(), second.Id, "Other open", null);
        var firstClosed = await CreateCase(CreateController(), first.Id, "First closed", null);
        await UpdateCase(firstClosed.Id, "First closed", null, nameof(CaseStatus.Closed));

        var filtered = await ListCases(first.Id, nameof(CaseStatus.Open));
        var only = Assert.Single(filtered);
        Assert.Equal(kept.Id, only.Id);
        Assert.DoesNotContain(filtered, work => work.Id == otherOpen.Id);
        Assert.DoesNotContain(filtered, work => work.Id == firstClosed.Id);
    }

    [Fact]
    public async Task GetAll_InvalidStatus_ReturnsValidationError()
    {
        var result = await CreateController().GetAll(null, "Done");

        AssertValidationProblem(result, "status", "Status must be Open, InProgress, or Closed.");
    }

    [Fact]
    public async Task GetAll_Search_MatchesTitleOrDescription_CaseInsensitive()
    {
        var customer = await AddCustomer();
        var byTitle = await CreateCase(CreateController(), customer.Id, "Needle Title", "plain");
        var byDescription = await CreateCase(CreateController(), customer.Id, "Other title", "Has NeEdLe here");
        await CreateCase(CreateController(), customer.Id, "Unrelated", "nothing");

        var matches = await ListCases(search: "needle");
        Assert.Equal(
            new[] { byDescription.Id, byTitle.Id },
            matches.Select(work => work.Id).OrderByDescending(id => id).ToArray());
    }

    [Fact]
    public async Task GetAll_Search_TrimsWhitespace_BlankMeansNoFilter_LiteralSpecialChars()
    {
        var customer = await AddCustomer();
        var literal = await CreateCase(CreateController(), customer.Id, "Title with %_ chars", "100% done");
        var other = await CreateCase(CreateController(), customer.Id, "Plain title", null);

        var blank = await ListCases(search: "   ");
        Assert.Equal(2, blank.Length);
        Assert.Contains(blank, work => work.Id == literal.Id);
        Assert.Contains(blank, work => work.Id == other.Id);

        var trimmed = await ListCases(search: "  Plain title  ");
        Assert.Equal(other.Id, Assert.Single(trimmed).Id);

        Assert.Equal(literal.Id, Assert.Single(await ListCases(search: "%_")).Id);
        Assert.Equal(literal.Id, Assert.Single(await ListCases(search: "100%")).Id);
    }

    [Fact]
    public async Task GetAll_Search_CombinesWithCustomerIdAndStatus()
    {
        var first = await AddCustomer();
        var second = await AddCustomer("Other Studio", "other-search@example.com");
        var kept = await CreateCase(CreateController(), first.Id, "Shared needle", null);
        var wrongCustomer = await CreateCase(CreateController(), second.Id, "Shared needle", null);
        var wrongStatus = await CreateCase(CreateController(), first.Id, "Shared needle closed", null);
        await UpdateCase(wrongStatus.Id, "Shared needle closed", null, nameof(CaseStatus.Closed));
        await CreateCase(CreateController(), first.Id, "Different open", null);

        var filtered = await ListCases(first.Id, nameof(CaseStatus.Open), "needle");
        Assert.Equal(kept.Id, Assert.Single(filtered).Id);
        Assert.DoesNotContain(filtered, work => work.Id == wrongCustomer.Id);
        Assert.DoesNotContain(filtered, work => work.Id == wrongStatus.Id);
    }

    [Fact]
    public async Task Create_DoesNotChangeTheCustomer()
    {
        var customer = await AddCustomer();
        var createdAt = customer.CreatedAt;

        await CreateCase(CreateController(), customer.Id, "Booking page", null);

        var stored = await _database.Customers.AsNoTracking().SingleAsync();
        Assert.Equal(customer.Id, stored.Id);
        Assert.Equal("Studio 22", stored.Name);
        Assert.Equal("studio22@example.com", stored.Email);
        Assert.Equal(createdAt, stored.CreatedAt);
    }

    [Fact]
    public async Task Update_ValidCase_ThenGetById_ReturnsUpdated()
    {
        var customer = await AddCustomer();
        var created = await CreateCase(CreateController(), customer.Id, "Booking page", "Old details");

        var updated = await UpdateCase(created.Id, "  New title  ", "  New details  ", nameof(CaseStatus.InProgress));

        Assert.Equal(created.Id, updated.Id);
        Assert.Equal(customer.Id, updated.CustomerId);
        Assert.Equal("New title", updated.Title);
        Assert.Equal("New details", updated.Description);
        Assert.Equal(CaseStatus.InProgress, updated.Status);
        Assert.Equal(created.CreatedAt, updated.CreatedAt);

        var found = await GetCase(created.Id);
        Assert.Equal("New title", found.Title);
        Assert.Equal("New details", found.Description);
        Assert.Equal(CaseStatus.InProgress, found.Status);
        Assert.Equal(created.CreatedAt, found.CreatedAt);
    }

    [Fact]
    public async Task Update_AllStatuses_AreSaved()
    {
        var customer = await AddCustomer();
        var created = await CreateCase(CreateController(), customer.Id, "Booking page", "Details");

        Assert.Equal(CaseStatus.Open, (await UpdateCase(created.Id, "Booking page", "Details", nameof(CaseStatus.Open))).Status);
        Assert.Equal(CaseStatus.InProgress, (await UpdateCase(created.Id, "Booking page", "Details", nameof(CaseStatus.InProgress))).Status);
        Assert.Equal(CaseStatus.Closed, (await UpdateCase(created.Id, "Booking page", "Details", nameof(CaseStatus.Closed))).Status);

        var found = await GetCase(created.Id);
        Assert.Equal(CaseStatus.Closed, found.Status);
    }

    [Fact]
    public async Task Update_TitleOf200Characters_ReturnsUpdated()
    {
        var customer = await AddCustomer();
        var created = await CreateCase(CreateController(), customer.Id, "Booking page", null);
        var title = new string('a', 200);

        var updated = await UpdateCase(created.Id, title, null, nameof(CaseStatus.Open));

        Assert.Equal(title, updated.Title);
    }

    [Fact]
    public async Task Update_BlankTitle_ReturnsValidationError_DoesNotChange()
    {
        var customer = await AddCustomer();
        var created = await CreateCase(CreateController(), customer.Id, "Keep title", "Keep details");

        await AssertUnchangedAfterInvalidUpdate(
            created,
            new CaseUpdate { Title = "   ", Description = "Changed", Status = nameof(CaseStatus.Closed) },
            nameof(Case.Title),
            "Title is required.");
    }

    [Fact]
    public async Task Update_TitleTooLong_ReturnsValidationError_DoesNotChange()
    {
        var customer = await AddCustomer();
        var created = await CreateCase(CreateController(), customer.Id, "Keep title", "Keep details");

        await AssertUnchangedAfterInvalidUpdate(
            created,
            new CaseUpdate
            {
                Title = new string('a', 201),
                Description = "Changed",
                Status = nameof(CaseStatus.Closed),
            },
            nameof(Case.Title),
            "Title must be at most 200 characters.");
    }

    [Fact]
    public async Task Update_InvalidStatus_ReturnsValidationError_DoesNotChange()
    {
        var customer = await AddCustomer();
        var created = await CreateCase(CreateController(), customer.Id, "Keep title", "Keep details");
        var changes = new CaseUpdate { Title = "Changed", Description = "Changed", Status = "Done" };

        await AssertUnchangedAfterInvalidUpdate(
            created,
            changes,
            nameof(CaseUpdate.Status),
            "Status must be Open, InProgress, or Closed.");

        changes.Status = null;
        await AssertUnchangedAfterInvalidUpdate(
            created,
            changes,
            nameof(CaseUpdate.Status),
            "Status must be Open, InProgress, or Closed.");
    }

    [Fact]
    public async Task Update_BlankDescription_ClearsIt()
    {
        var customer = await AddCustomer();
        var created = await CreateCase(CreateController(), customer.Id, "Booking page", "Old details");

        var cleared = await UpdateCase(created.Id, "Booking page", "   ", nameof(CaseStatus.Open));
        Assert.Null(cleared.Description);
        Assert.Null((await GetCase(created.Id)).Description);

        var clearedAgain = await UpdateCase(created.Id, "Booking page", null, nameof(CaseStatus.Open));
        Assert.Null(clearedAgain.Description);
        Assert.Null((await GetCase(created.Id)).Description);
    }

    [Fact]
    public async Task Update_IgnoresIdCustomerIdAndCreatedAt()
    {
        var customer = await AddCustomer();
        var other = await AddCustomer("Other Studio", "other-case-update@example.com");
        var created = await CreateCase(CreateController(), customer.Id, "Booking page", "Details");
        var forgedAt = new DateTime(1999, 1, 1, 0, 0, 0, DateTimeKind.Utc);

        var result = await CreateController().Update(created.Id, new CaseUpdate
        {
            Id = 888_888,
            CustomerId = other.Id,
            Title = "Still here",
            Description = "Kept customer",
            Status = nameof(CaseStatus.Closed),
            CreatedAt = forgedAt,
        });

        var ok = Assert.IsType<OkObjectResult>(result);
        var updated = Assert.IsType<Case>(ok.Value);
        Assert.Equal(created.Id, updated.Id);
        Assert.Equal(customer.Id, updated.CustomerId);
        Assert.NotEqual(other.Id, updated.CustomerId);
        Assert.Equal(created.CreatedAt, updated.CreatedAt);
        Assert.NotEqual(forgedAt, updated.CreatedAt);
        Assert.Equal("Still here", updated.Title);
        Assert.Equal(CaseStatus.Closed, updated.Status);

        var found = await GetCase(created.Id);
        Assert.Equal(customer.Id, found.CustomerId);
        Assert.Equal(created.CreatedAt, found.CreatedAt);
        Assert.Equal("Still here", found.Title);
    }

    [Fact]
    public async Task Update_DoesNotChangeUnrelatedCase()
    {
        var customer = await AddCustomer();
        var target = await CreateCase(CreateController(), customer.Id, "Target", "Target details");
        var other = await CreateCase(CreateController(), customer.Id, "Other", "Other details");

        await UpdateCase(target.Id, "Target updated", "Updated details", nameof(CaseStatus.Closed));

        var found = await GetCase(other.Id);
        Assert.Equal(other.Id, found.Id);
        Assert.Equal(customer.Id, found.CustomerId);
        Assert.Equal("Other", found.Title);
        Assert.Equal("Other details", found.Description);
        Assert.Equal(CaseStatus.Open, found.Status);
        Assert.Equal(other.CreatedAt, found.CreatedAt);
    }

    [Fact]
    public async Task Update_UnknownId_ReturnsNotFound()
    {
        var customer = await AddCustomer();
        var created = await CreateCase(CreateController(), customer.Id, "Booking page", "Details");

        var result = await CreateController().Update(int.MaxValue, new CaseUpdate
        {
            Title = "Missing",
            Description = "Missing",
            Status = nameof(CaseStatus.Open),
        });

        Assert.IsType<NotFoundResult>(result);
        var found = await GetCase(created.Id);
        Assert.Equal("Booking page", found.Title);
        Assert.Equal("Details", found.Description);
    }

    [Fact]
    public async Task Delete_ExistingCase_ReturnsNoContent_ThenGetByIdNotFound()
    {
        var customer = await AddCustomer();
        var created = await CreateCase(CreateController(), customer.Id, "Delete me", "Details");

        Assert.IsType<NoContentResult>(await CreateController().Delete(created.Id));
        Assert.IsType<NotFoundResult>(await CreateController().GetById(created.Id));
    }

    [Fact]
    public async Task Delete_RemovesFromList_AndKeepsCustomerAndOtherCase()
    {
        var customer = await AddCustomer();
        var target = await CreateCase(CreateController(), customer.Id, "Delete me", "Gone");
        var other = await CreateCase(CreateController(), customer.Id, "Keep me", "Stay");
        var customerCreatedAt = customer.CreatedAt;

        Assert.IsType<NoContentResult>(await CreateController().Delete(target.Id));

        var cases = await ListCases();
        var kept = Assert.Single(cases);
        Assert.Equal(other.Id, kept.Id);
        Assert.Equal("Keep me", kept.Title);
        Assert.Equal("Stay", kept.Description);
        Assert.Equal(other.CreatedAt, kept.CreatedAt);

        var storedCustomer = await _database.Customers.AsNoTracking().SingleAsync(row => row.Id == customer.Id);
        Assert.Equal("Studio 22", storedCustomer.Name);
        Assert.Equal("studio22@example.com", storedCustomer.Email);
        Assert.Equal(customerCreatedAt, storedCustomer.CreatedAt);
    }

    [Fact]
    public async Task Delete_UnknownId_ReturnsNotFound()
    {
        var customer = await AddCustomer();
        var created = await CreateCase(CreateController(), customer.Id, "Keep me", "Stay");

        Assert.IsType<NotFoundResult>(await CreateController().Delete(int.MaxValue));

        var found = await GetCase(created.Id);
        Assert.Equal("Keep me", found.Title);
        Assert.Equal("Stay", found.Description);
    }

    [Fact]
    public async Task Delete_CaseWithTasks_ReturnsConflict_AndKeepsCaseAndTask()
    {
        var customer = await AddCustomer();
        var created = await CreateCase(CreateController(), customer.Id, "Keep me", "Stay");
        _database.CaseTasks.Add(new CaseTask
        {
            CaseId = created.Id,
            Title = "Design the booking page",
        });
        await _database.SaveChangesAsync();

        var result = await CreateController().Delete(created.Id);
        var conflict = Assert.IsType<ObjectResult>(result);
        Assert.Equal(StatusCodes.Status409Conflict, conflict.StatusCode);
        var problem = Assert.IsType<ProblemDetails>(conflict.Value);
        Assert.Equal("This case has tasks and cannot be deleted.", problem.Detail);

        Assert.NotNull(await _database.Cases.AsNoTracking().SingleOrDefaultAsync(row => row.Id == created.Id));
        Assert.Equal(1, await _database.CaseTasks.AsNoTracking().CountAsync());
    }

    [Fact]
    public async Task Delete_SameIdTwice_SecondReturnsNotFound()
    {
        var customer = await AddCustomer();
        var created = await CreateCase(CreateController(), customer.Id, "Delete twice", null);

        Assert.IsType<NoContentResult>(await CreateController().Delete(created.Id));
        Assert.IsType<NotFoundResult>(await CreateController().Delete(created.Id));
    }

    [Fact]
    public async Task GetAll_WithoutPagination_StillReturnsArray()
    {
        var customer = await AddCustomer();
        var created = await CreateCase(CreateController(), customer.Id, "Array case", null);

        var ok = Assert.IsType<OkObjectResult>(await CreateController().GetAll());
        var cases = Assert.IsType<Case[]>(ok.Value);
        Assert.Equal(created.Id, Assert.Single(cases).Id);
    }

    [Fact]
    public async Task GetAll_Pagination_ReturnsPageMetadata_AndSlicesItems()
    {
        var customer = await AddCustomer();
        var oldest = await CreateCase(CreateController(), customer.Id, "Case A", null);
        var middle = await CreateCase(CreateController(), customer.Id, "Case B", null);
        var newest = await CreateCase(CreateController(), customer.Id, "Case C", null);
        await SetCreatedAt(oldest.Id, new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc));
        await SetCreatedAt(middle.Id, new DateTime(2026, 1, 2, 0, 0, 0, DateTimeKind.Utc));
        await SetCreatedAt(newest.Id, new DateTime(2026, 1, 3, 0, 0, 0, DateTimeKind.Utc));

        var first = await PageCases(page: 1, pageSize: 2);
        Assert.Equal(1, first.Page);
        Assert.Equal(2, first.PageSize);
        Assert.Equal(3, first.TotalCount);
        Assert.Equal(new[] { newest.Id, middle.Id }, first.Items.Select(c => c.Id).ToArray());

        var second = await PageCases(page: 2, pageSize: 2);
        Assert.Equal(new[] { oldest.Id }, second.Items.Select(c => c.Id).ToArray());
    }

    [Fact]
    public async Task GetAll_Pagination_OutOfRangePage_ReturnsEmptyItems_WithTotalCount()
    {
        var customer = await AddCustomer();
        await CreateCase(CreateController(), customer.Id, "Only case", null);

        var page = await PageCases(page: 5, pageSize: 10);
        Assert.Empty(page.Items);
        Assert.Equal(1, page.TotalCount);
        Assert.Equal(5, page.Page);
    }

    [Fact]
    public async Task GetAll_Pagination_AppliesFiltersBeforeCountAndSlice()
    {
        var first = await AddCustomer("Filter One", "filter-one@example.com");
        var second = await AddCustomer("Filter Two", "filter-two@example.com");
        await CreateCase(CreateController(), first.Id, "Keep needle", null);
        var matchTwo = await CreateCase(CreateController(), first.Id, "Other needle", null);
        await CreateCase(CreateController(), second.Id, "needle elsewhere", null);
        await UpdateCase(matchTwo.Id, "Other needle", null, nameof(CaseStatus.Closed));

        var page = await PageCases(
            page: 1,
            pageSize: 10,
            customerId: first.Id,
            status: nameof(CaseStatus.Open),
            search: "needle");
        Assert.Equal(1, page.TotalCount);
        Assert.Equal("Keep needle", Assert.Single(page.Items).Title);
    }

    [Fact]
    public async Task GetAll_Pagination_InvalidValues_ReturnValidationErrors()
    {
        AssertValidationProblem(
            await CreateController().GetAll(page: 0, pageSize: 20),
            "page",
            "page must be at least 1.");
        AssertValidationProblem(
            await CreateController().GetAll(page: 1, pageSize: 0),
            "pageSize",
            "pageSize must be at least 1.");
        AssertValidationProblem(
            await CreateController().GetAll(page: 1, pageSize: 101),
            "pageSize",
            "pageSize must be at most 100.");
    }

    [Fact]
    public async Task Export_Empty_ReturnsHeadersOnly_DoesNotMutate()
    {
        var beforeCount = await _database.Cases.CountAsync();
        var result = Assert.IsType<FileContentResult>(await CreateController().Export());
        Assert.Equal("text/csv; charset=utf-8", result.ContentType);
        Assert.StartsWith("cases-", result.FileDownloadName);
        Assert.EndsWith(".csv", result.FileDownloadName);
        var text = StripBom(Encoding.UTF8.GetString(result.FileContents));
        Assert.Equal(
            "Id,Customer Id,Customer Name,Title,Description,Status,Created At (UTC),Archived At (UTC)\r\n",
            text);
        Assert.Equal(beforeCount, await _database.Cases.CountAsync());
    }

    [Fact]
    public async Task Export_AppliesFilters_IncludesAllMatchingRows_NotJustPage()
    {
        var customer = await AddCustomer("Export Customer", "export-cases@example.com");
        var other = await AddCustomer("Other Customer", "other-cases@example.com");
        var marker = $"CaseExport-{Guid.NewGuid():N}";
        for (var i = 0; i < 5; i++)
        {
            await CreateCase(CreateController(), customer.Id, $"{marker} {i}", null);
        }

        await CreateCase(CreateController(), other.Id, $"{marker} other", null);
        var closed = await CreateCase(CreateController(), customer.Id, $"{marker} closed", null);
        await UpdateCase(closed.Id, $"{marker} closed", null, nameof(CaseStatus.Closed));

        var page = await PageCases(
            page: 1,
            pageSize: 2,
            customerId: customer.Id,
            status: nameof(CaseStatus.Open),
            search: marker);
        Assert.Equal(5, page.TotalCount);
        Assert.Equal(2, page.Items.Length);

        var result = Assert.IsType<FileContentResult>(
            await CreateController().Export(customer.Id, nameof(CaseStatus.Open), marker));
        var text = StripBom(Encoding.UTF8.GetString(result.FileContents));
        var lines = text.Split("\r\n", StringSplitOptions.RemoveEmptyEntries);
        Assert.Equal(6, lines.Length);
        Assert.Contains("Export Customer", text);
        Assert.DoesNotContain("Other Customer", text);
        Assert.DoesNotContain($"{marker} closed", text);
        Assert.Contains($"{marker} 0", text);
        Assert.Contains($"{marker} 4", text);
        Assert.Contains(" UTC", text);
    }

    [Fact]
    public async Task Export_SpecialCharactersAndFormulaLikeValues_AreSafe()
    {
        var customer = await AddCustomer("CSV Customer", "csv-case@example.com");
        await CreateCase(
            CreateController(),
            customer.Id,
            "Title, \"quoted\"",
            "=CMD|'/C calc'!A0\nsecond");

        var result = Assert.IsType<FileContentResult>(await CreateController().Export(search: "quoted"));
        var text = StripBom(Encoding.UTF8.GetString(result.FileContents));
        Assert.Contains("\"Title, \"\"quoted\"\"\"", text);
        Assert.Contains("'=CMD", text);
        Assert.DoesNotContain("password", text, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("Jwt", text, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Export_ExceedsMaxRows_ReturnsBadRequest_DoesNotMutate()
    {
        var customer = await AddCustomer("Limit Customer", "limit-case@example.com");
        await CreateCase(CreateController(), customer.Id, "One", null);
        await CreateCase(CreateController(), customer.Id, "Two", null);
        var beforeCount = await _database.Cases.CountAsync();

        var result = await CreateController(maxRows: 1).Export();
        var problem = Assert.IsType<ObjectResult>(result);
        Assert.Equal(StatusCodes.Status400BadRequest, problem.StatusCode);
        Assert.Equal(beforeCount, await _database.Cases.CountAsync());
    }

    [Fact]
    public async Task Export_AppliesDateRangeFilters_IncludesOnlyMatchingRows()
    {
        var customer = await AddCustomer("Range Customer", "range-case@example.com");
        var early = await CreateCase(CreateController(), customer.Id, "Early Case", null);
        var middle = await CreateCase(CreateController(), customer.Id, "Middle Case", null);
        var late = await CreateCase(CreateController(), customer.Id, "Late Case", null);

        await SetCreatedAt(early.Id, new DateTime(2026, 6, 1, 10, 0, 0, DateTimeKind.Utc));
        await SetCreatedAt(middle.Id, new DateTime(2026, 6, 15, 12, 0, 0, DateTimeKind.Utc));
        await SetCreatedAt(late.Id, new DateTime(2026, 6, 30, 14, 0, 0, DateTimeKind.Utc));

        var result = Assert.IsType<FileContentResult>(
            await CreateController().Export(
                fromDate: new DateOnly(2026, 6, 10),
                toDate: new DateOnly(2026, 6, 20)));

        var text = StripBom(Encoding.UTF8.GetString(result.FileContents));
        Assert.DoesNotContain("Early Case", text);
        Assert.Contains("Middle Case", text);
        Assert.DoesNotContain("Late Case", text);
    }

    [Fact]
    public async Task Export_InvalidDateRange_ReturnsBadRequest()
    {
        var controller = CreateController();
        var result = await controller.Export(
            fromDate: new DateOnly(2026, 6, 20),
            toDate: new DateOnly(2026, 6, 10));

        AssertValidationProblem(result, "fromDate", "fromDate cannot be after toDate.");
    }

    private static string StripBom(string text) =>
        text.Length > 0 && text[0] == '\uFEFF' ? text[1..] : text;

    private CasesController CreateController(int maxRows = 10_000) =>
        new(
            _database,
            new AiBusiness.Api.Services.CaseActivityWriter(_database),
            TestCsvExport.Service(maxRows));

    private async Task<Case[]> ListCases(
        int? customerId = null,
        string? status = null,
        string? search = null)
    {
        var result = await CreateController().GetAll(customerId, status, search);
        var ok = Assert.IsType<OkObjectResult>(result);
        return Assert.IsType<Case[]>(ok.Value);
    }

    private async Task<PagedResult<Case>> PageCases(
        int? page,
        int? pageSize,
        int? customerId = null,
        string? status = null,
        string? search = null)
    {
        var result = await CreateController().GetAll(
            customerId,
            status,
            search,
            archive: null,
            page,
            pageSize);
        var ok = Assert.IsType<OkObjectResult>(result);
        return Assert.IsType<PagedResult<Case>>(ok.Value);
    }

    private Task SetCreatedAt(int id, DateTime createdAt)
    {
        return _database.Cases
            .Where(work => work.Id == id)
            .ExecuteUpdateAsync(setters => setters.SetProperty(work => work.CreatedAt, createdAt));
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

    private async Task<Case> UpdateCase(int id, string title, string? description, string status)
    {
        var result = await CreateController().Update(id, new CaseUpdate
        {
            Title = title,
            Description = description,
            Status = status,
        });
        var ok = Assert.IsType<OkObjectResult>(result);
        return Assert.IsType<Case>(ok.Value);
    }

    private async Task<Case> GetCase(int id)
    {
        var result = await CreateController().GetById(id);
        var ok = Assert.IsType<OkObjectResult>(result);
        return Assert.IsType<Case>(ok.Value);
    }

    private async Task AssertUnchangedAfterInvalidUpdate(
        Case original,
        CaseUpdate changes,
        string field,
        string message)
    {
        var result = await CreateController().Update(original.Id, changes);
        AssertValidationProblem(result, field, message);

        var found = await GetCase(original.Id);
        Assert.Equal(original.Id, found.Id);
        Assert.Equal(original.CustomerId, found.CustomerId);
        Assert.Equal(original.Title, found.Title);
        Assert.Equal(original.Description, found.Description);
        Assert.Equal(original.Status, found.Status);
        Assert.Equal(original.CreatedAt, found.CreatedAt);
    }

    private static async Task<Case> CreateCase(
        CasesController controller,
        int customerId,
        string title,
        string? description)
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

    private static void AssertValidationProblem(IActionResult result, string field, string message)
    {
        var objectResult = Assert.IsAssignableFrom<ObjectResult>(result);
        var problem = Assert.IsType<ValidationProblemDetails>(objectResult.Value);
        Assert.True(problem.Errors.ContainsKey(field), $"Expected error for '{field}'.");
        Assert.Contains(message, problem.Errors[field]);
    }
}
