using AiBusiness.Api.Controllers;
using AiBusiness.Api.Data;
using AiBusiness.Api.Models;
using AiBusiness.Api.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;

namespace AiBusiness.Api.Tests;

public class CaseArchiveTests : IDisposable
{
    private readonly SqliteConnection _connection;
    private readonly AppDbContext _database;

    public CaseArchiveTests()
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
    public async Task Archive_ClosedCaseWithAllDoneTasks_SetsArchivedAt_AndRecordsActivity()
    {
        var work = await CreateClosedCaseWithDoneTask();
        var result = await Cases().Archive(work.Id);

        var ok = Assert.IsType<OkObjectResult>(result);
        var archived = Assert.IsType<Case>(ok.Value);
        Assert.NotNull(archived.ArchivedAt);
        Assert.Equal(DateTimeKind.Utc, archived.ArchivedAt.Value.Kind);
        Assert.Equal(CaseStatus.Closed, archived.Status);

        var activity = await _database.CaseActivities
            .AsNoTracking()
            .Where(a => a.CaseId == work.Id && a.EventType == CaseActivityEventType.CaseArchived)
            .SingleAsync();
        Assert.Equal("Case archived", activity.Description);

        Assert.Equal(1, await _database.Cases.CountAsync());
        Assert.Equal(1, await _database.CaseTasks.CountAsync(t => t.CaseId == work.Id));
    }

    [Fact]
    public async Task Archive_OpenCase_OrIncompleteTasks_ReturnsConflict()
    {
        var open = await CreateCase("Open work");
        var openResult = Assert.IsType<ObjectResult>(await Cases().Archive(open.Id));
        Assert.Equal(StatusCodes.Status409Conflict, openResult.StatusCode);

        var closed = await CreateCase("Closed incomplete");
        await UpdateStatus(closed.Id, CaseStatus.Closed);
        await CreateTask(closed.Id, "Still open", CaseTaskStatus.Todo);
        var incomplete = Assert.IsType<ObjectResult>(await Cases().Archive(closed.Id));
        Assert.Equal(StatusCodes.Status409Conflict, incomplete.StatusCode);
        Assert.Null((await _database.Cases.FindAsync(closed.Id))!.ArchivedAt);
    }

    [Fact]
    public async Task Archive_ClosedCaseWithNoTasks_Succeeds()
    {
        var work = await CreateCase("Empty closed");
        await UpdateStatus(work.Id, CaseStatus.Closed);
        var ok = Assert.IsType<OkObjectResult>(await Cases().Archive(work.Id));
        Assert.NotNull(Assert.IsType<Case>(ok.Value).ArchivedAt);
    }

    [Fact]
    public async Task Archive_AlreadyArchived_ReturnsConflict_WithoutChangingTimestamp()
    {
        var work = await CreateClosedCaseWithDoneTask();
        var first = Assert.IsType<Case>(Assert.IsType<OkObjectResult>(await Cases().Archive(work.Id)).Value);
        var stamp = first.ArchivedAt;

        var again = Assert.IsType<ObjectResult>(await Cases().Archive(work.Id));
        Assert.Equal(StatusCodes.Status409Conflict, again.StatusCode);
        Assert.Equal(stamp, (await _database.Cases.AsNoTracking().SingleAsync(c => c.Id == work.Id)).ArchivedAt);
    }

    [Fact]
    public async Task Restore_ClearsArchivedAt_LeavesClosed_AndRecordsActivity()
    {
        var work = await CreateClosedCaseWithDoneTask();
        await Cases().Archive(work.Id);

        var ok = Assert.IsType<OkObjectResult>(await Cases().Restore(work.Id));
        var restored = Assert.IsType<Case>(ok.Value);
        Assert.Null(restored.ArchivedAt);
        Assert.Equal(CaseStatus.Closed, restored.Status);

        Assert.True(await _database.CaseActivities.AnyAsync(a =>
            a.CaseId == work.Id && a.EventType == CaseActivityEventType.CaseRestored));
    }

    [Fact]
    public async Task Restore_WhenNotArchived_ReturnsConflict()
    {
        var work = await CreateCase("Active");
        var result = Assert.IsType<ObjectResult>(await Cases().Restore(work.Id));
        Assert.Equal(StatusCodes.Status409Conflict, result.StatusCode);
    }

    [Fact]
    public async Task Update_And_Delete_OnArchivedCase_AreBlocked()
    {
        var work = await CreateClosedCaseWithDoneTask();
        await Cases().Archive(work.Id);

        var update = Assert.IsType<ObjectResult>(await Cases().Update(work.Id, new CaseUpdate
        {
            Title = "Changed",
            Description = "Changed",
            Status = nameof(CaseStatus.Open),
        }));
        Assert.Equal(StatusCodes.Status409Conflict, update.StatusCode);

        var delete = Assert.IsType<ObjectResult>(await Cases().Delete(work.Id));
        Assert.Equal(StatusCodes.Status409Conflict, delete.StatusCode);

        var stored = await _database.Cases.AsNoTracking().SingleAsync(c => c.Id == work.Id);
        Assert.Equal(work.Title, stored.Title);
        Assert.NotNull(stored.ArchivedAt);
    }

    [Fact]
    public async Task TaskMutations_OnArchivedCase_AreBlocked()
    {
        var work = await CreateClosedCaseWithDoneTask();
        var task = await _database.CaseTasks.AsNoTracking().SingleAsync(t => t.CaseId == work.Id);
        await Cases().Archive(work.Id);

        var create = Assert.IsType<ObjectResult>(await Tasks().Create(new CaseTask
        {
            CaseId = work.Id,
            Title = "New task",
        }));
        Assert.Equal(StatusCodes.Status409Conflict, create.StatusCode);

        var update = Assert.IsType<ObjectResult>(await Tasks().Update(task.Id, new CaseTaskUpdate
        {
            Title = "Changed",
            Description = null,
            DueDate = null,
            Status = nameof(CaseTaskStatus.Todo),
        }));
        Assert.Equal(StatusCodes.Status409Conflict, update.StatusCode);

        var delete = Assert.IsType<ObjectResult>(await Tasks().Delete(task.Id));
        Assert.Equal(StatusCodes.Status409Conflict, delete.StatusCode);

        Assert.Equal(1, await _database.CaseTasks.CountAsync(t => t.CaseId == work.Id));
    }

    [Fact]
    public async Task GetAll_DefaultsToActive_AndSupportsArchiveFilters()
    {
        var active = await CreateCase("Active case");
        var archived = await CreateClosedCaseWithDoneTask("Archived case");
        await Cases().Archive(archived.Id);

        var defaultList = Assert.IsType<Case[]>(
            Assert.IsType<OkObjectResult>(await Cases().GetAll()).Value);
        Assert.Equal(new[] { active.Id }, defaultList.Select(c => c.Id).ToArray());

        var archivedOnly = Assert.IsType<Case[]>(
            Assert.IsType<OkObjectResult>(await Cases().GetAll(archive: "archived")).Value);
        Assert.Equal(new[] { archived.Id }, archivedOnly.Select(c => c.Id).ToArray());

        var all = Assert.IsType<Case[]>(
            Assert.IsType<OkObjectResult>(await Cases().GetAll(archive: "all")).Value);
        Assert.Equal(2, all.Length);
    }

    [Fact]
    public async Task Export_RespectsArchiveFilter_AndIncludesArchivedAtColumn()
    {
        var archived = await CreateClosedCaseWithDoneTask("Export archived");
        await Cases().Archive(archived.Id);

        var result = Assert.IsType<FileContentResult>(
            await Cases().Export(archive: "archived"));
        var text = System.Text.Encoding.UTF8.GetString(result.FileContents).TrimStart('\uFEFF');
        Assert.Contains("Archived At (UTC)", text);
        Assert.Contains("Export archived", text);
        Assert.Contains(" UTC", text);
    }

    [Fact]
    public async Task CustomerDelete_StillBlocked_WhenOnlyArchivedCasesRemain()
    {
        var work = await CreateClosedCaseWithDoneTask();
        var customerId = work.CustomerId;
        await Cases().Archive(work.Id);

        var customers = new CustomersController(_database, TestCsvExport.Service());
        var result = Assert.IsType<ObjectResult>(await customers.Delete(customerId));
        Assert.Equal(StatusCodes.Status409Conflict, result.StatusCode);
        Assert.True(await _database.Customers.AnyAsync(c => c.Id == customerId));
    }

    private CasesController Cases() =>
        new(_database, new CaseActivityWriter(_database), TestCsvExport.Service());

    private TasksController Tasks() =>
        new(
            _database,
            new CaseActivityWriter(_database),
            new FixedBusinessClock(new DateOnly(2026, 9, 27)));

    private async Task<Case> CreateCase(string title = "Booking page")
    {
        var customer = new Customer
        {
            Name = "Studio 22",
            Email = $"studio-{Guid.NewGuid():N}@example.com",
            CreatedAt = DateTime.UtcNow,
        };
        _database.Customers.Add(customer);
        await _database.SaveChangesAsync();

        var created = Assert.IsType<CreatedAtActionResult>(
            await Cases().Create(new Case { CustomerId = customer.Id, Title = title }));
        return Assert.IsType<Case>(created.Value);
    }

    private async Task<Case> CreateClosedCaseWithDoneTask(string title = "Ready to archive")
    {
        var work = await CreateCase(title);
        await CreateTask(work.Id, "Finish", CaseTaskStatus.Done);
        await UpdateStatus(work.Id, CaseStatus.Closed);
        return await _database.Cases.AsNoTracking().SingleAsync(c => c.Id == work.Id);
    }

    private async Task CreateTask(int caseId, string title, CaseTaskStatus status)
    {
        var created = Assert.IsType<CreatedAtActionResult>(
            await Tasks().Create(new CaseTask { CaseId = caseId, Title = title }));
        var task = Assert.IsType<CaseTask>(created.Value);
        if (status != CaseTaskStatus.Todo)
        {
            await Tasks().Update(task.Id, new CaseTaskUpdate
            {
                Title = title,
                Description = null,
                DueDate = null,
                Status = status.ToString(),
            });
        }
    }

    private async Task UpdateStatus(int caseId, CaseStatus status)
    {
        var existing = await _database.Cases.FindAsync(caseId);
        Assert.NotNull(existing);
        await Cases().Update(caseId, new CaseUpdate
        {
            Title = existing.Title,
            Description = existing.Description,
            Status = status.ToString(),
        });
    }

    private sealed class FixedBusinessClock(DateOnly today) : IBusinessClock
    {
        public DateOnly Today { get; } = today;
        public string TimeZoneId => "Europe/Copenhagen";
    }
}
