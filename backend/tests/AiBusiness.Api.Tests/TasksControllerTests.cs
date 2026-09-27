using AiBusiness.Api.Controllers;
using AiBusiness.Api.Data;
using AiBusiness.Api.Models;
using AiBusiness.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;

namespace AiBusiness.Api.Tests;

public class TasksControllerTests : IDisposable
{
    private readonly SqliteConnection _connection;
    private readonly AppDbContext _database;

    public TasksControllerTests()
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
    public async Task Create_ValidTask_ReturnsCreatedTodoTask()
    {
        var work = await AddCase();
        var controller = CreateController();

        var created = await CreateTask(
            controller,
            work.Id,
            "  Design the booking page  ",
            "  Wireframes  ",
            new DateOnly(2026, 10, 1));

        Assert.True(created.Id > 0);
        Assert.Equal(work.Id, created.CaseId);
        Assert.Equal("Design the booking page", created.Title);
        Assert.Equal("Wireframes", created.Description);
        Assert.Equal(new DateOnly(2026, 10, 1), created.DueDate);
        Assert.Equal(CaseTaskStatus.Todo, created.Status);
        Assert.Equal(DateTimeKind.Utc, created.CreatedAt.Kind);
    }

    [Fact]
    public async Task Create_IgnoresSubmittedIdStatusAndCreatedAt()
    {
        var work = await AddCase();
        var forged = new DateTime(1999, 1, 1, 0, 0, 0, DateTimeKind.Utc);

        var result = await CreateController().Create(new CaseTask
        {
            Id = 999,
            CaseId = work.Id,
            Title = "Ignored fields",
            Status = CaseTaskStatus.Done,
            CreatedAt = forged,
        });

        var createdResult = Assert.IsType<CreatedAtActionResult>(result);
        var created = Assert.IsType<CaseTask>(createdResult.Value);
        Assert.NotEqual(999, created.Id);
        Assert.Equal(CaseTaskStatus.Todo, created.Status);
        Assert.NotEqual(forged, created.CreatedAt);
    }

    [Fact]
    public async Task Create_ThenGetById_ReturnsSavedFields()
    {
        var work = await AddCase();
        var created = await CreateTask(CreateController(), work.Id, "Design page", "Details", null);

        var getResult = await CreateController().GetById(created.Id);
        var ok = Assert.IsType<OkObjectResult>(getResult);
        var loaded = Assert.IsType<CaseTask>(ok.Value);

        Assert.Equal(created.Id, loaded.Id);
        Assert.Equal(work.Id, loaded.CaseId);
        Assert.Equal("Design page", loaded.Title);
        Assert.Equal("Details", loaded.Description);
        Assert.Null(loaded.DueDate);
        Assert.Equal(CaseTaskStatus.Todo, loaded.Status);
        Assert.Equal(created.CreatedAt, loaded.CreatedAt);
    }

    [Fact]
    public async Task GetById_UnknownId_ReturnsNotFound()
    {
        Assert.IsType<NotFoundResult>(await CreateController().GetById(int.MaxValue));
    }

    [Fact]
    public async Task Create_BlankTitle_ReturnsValidationErrorAndStoresNothing()
    {
        var work = await AddCase();
        var result = await CreateController().Create(new CaseTask
        {
            CaseId = work.Id,
            Title = "   ",
        });

        Assert.IsType<ObjectResult>(result);
        Assert.Equal(0, await _database.CaseTasks.CountAsync());
    }

    [Fact]
    public async Task Create_TitleTooLong_ReturnsValidationErrorAndStoresNothing()
    {
        var work = await AddCase();
        var result = await CreateController().Create(new CaseTask
        {
            CaseId = work.Id,
            Title = new string('a', 201),
        });

        Assert.IsType<ObjectResult>(result);
        Assert.Equal(0, await _database.CaseTasks.CountAsync());
    }

    [Fact]
    public async Task Create_MissingCase_ReturnsValidationErrorAndStoresNothing()
    {
        var missing = await CreateController().Create(new CaseTask
        {
            CaseId = 0,
            Title = "No case",
        });
        var unknown = await CreateController().Create(new CaseTask
        {
            CaseId = int.MaxValue,
            Title = "Unknown case",
        });

        Assert.IsType<ObjectResult>(missing);
        Assert.IsType<ObjectResult>(unknown);
        Assert.Equal(0, await _database.CaseTasks.CountAsync());
    }

    [Fact]
    public async Task GetAll_OrdersNewestFirst_ThenHighestId()
    {
        var work = await AddCase();
        var first = await CreateTask(CreateController(), work.Id, "First", null, null);
        var second = await CreateTask(CreateController(), work.Id, "Second", null, null);
        await Task.Delay(5);
        var third = await CreateTask(CreateController(), work.Id, "Third", null, null);

        var items = await ListTasks();
        Assert.Equal(new[] { third.Id, second.Id, first.Id }, items.Select(task => task.Id).ToArray());
    }

    [Fact]
    public async Task GetAll_FiltersByCaseId_AndStatus()
    {
        var first = await AddCase("First case");
        var second = await AddCase("Second case");
        var todo = await CreateTask(CreateController(), first.Id, "Todo task", null, null);
        var progress = await CreateTask(CreateController(), first.Id, "Progress task", null, null);
        await UpdateTask(progress.Id, "Progress task", null, null, CaseTaskStatus.InProgress);
        await CreateTask(CreateController(), second.Id, "Other todo", null, null);

        var byCase = await ListTasks(first.Id, null);
        Assert.Equal(2, byCase.Length);
        Assert.All(byCase, task => Assert.Equal(first.Id, task.CaseId));

        var byStatus = await ListTasks(null, nameof(CaseTaskStatus.Todo));
        Assert.Contains(byStatus, task => task.Id == todo.Id);
        Assert.DoesNotContain(byStatus, task => task.Id == progress.Id);

        var combined = await ListTasks(first.Id, nameof(CaseTaskStatus.InProgress));
        var only = Assert.Single(combined);
        Assert.Equal(progress.Id, only.Id);
    }

    [Fact]
    public async Task GetAll_InvalidStatus_ReturnsValidationError()
    {
        var result = await CreateController().GetAll(null, "Doing");
        Assert.IsType<ObjectResult>(result);
    }

    [Fact]
    public async Task Update_ValidTask_ThenGetById_ReturnsUpdated()
    {
        var work = await AddCase();
        var created = await CreateTask(CreateController(), work.Id, "Design page", "Old", new DateOnly(2026, 10, 1));

        var updated = await UpdateTask(
            created.Id,
            "Design page v2",
            "New details",
            new DateOnly(2026, 11, 2),
            CaseTaskStatus.Done);

        Assert.Equal("Design page v2", updated.Title);
        Assert.Equal("New details", updated.Description);
        Assert.Equal(new DateOnly(2026, 11, 2), updated.DueDate);
        Assert.Equal(CaseTaskStatus.Done, updated.Status);
        Assert.Equal(created.CreatedAt, updated.CreatedAt);
        Assert.Equal(work.Id, updated.CaseId);

        var loaded = await GetTask(created.Id);
        Assert.Equal("Design page v2", loaded.Title);
        Assert.Equal(CaseTaskStatus.Done, loaded.Status);
    }

    [Fact]
    public async Task Update_ClearsOptionalFields()
    {
        var work = await AddCase();
        var created = await CreateTask(
            CreateController(),
            work.Id,
            "Keep title",
            "Remove me",
            new DateOnly(2026, 10, 1));

        var updated = await UpdateTask(created.Id, "Keep title", "  ", null, CaseTaskStatus.Todo);

        Assert.Null(updated.Description);
        Assert.Null(updated.DueDate);
    }

    [Fact]
    public async Task Update_IgnoresIdCaseIdAndCreatedAt()
    {
        var first = await AddCase("First");
        var second = await AddCase("Second");
        var created = await CreateTask(CreateController(), first.Id, "Protected", "Details", null);
        var forgedCreatedAt = created.CreatedAt.AddDays(9);

        var result = await CreateController().Update(created.Id, new CaseTaskUpdate
        {
            Id = created.Id + 50,
            CaseId = second.Id,
            Title = "Still protected",
            Description = "Details",
            Status = nameof(CaseTaskStatus.InProgress),
            CreatedAt = forgedCreatedAt,
        });

        var ok = Assert.IsType<OkObjectResult>(result);
        var updated = Assert.IsType<CaseTask>(ok.Value);
        Assert.Equal(created.Id, updated.Id);
        Assert.Equal(first.Id, updated.CaseId);
        Assert.Equal(created.CreatedAt, updated.CreatedAt);
        Assert.Equal(CaseTaskStatus.InProgress, updated.Status);
    }

    [Fact]
    public async Task Update_InvalidStatus_ReturnsValidationError_DoesNotChange()
    {
        var work = await AddCase();
        var created = await CreateTask(CreateController(), work.Id, "Keep title", "Keep", null);

        var result = await CreateController().Update(created.Id, new CaseTaskUpdate
        {
            Title = "Keep title",
            Description = "Keep",
            Status = "Finished",
        });

        Assert.IsType<ObjectResult>(result);
        var loaded = await GetTask(created.Id);
        Assert.Equal("Keep title", loaded.Title);
        Assert.Equal(CaseTaskStatus.Todo, loaded.Status);
    }

    [Fact]
    public async Task Update_UnknownId_ReturnsNotFound()
    {
        var work = await AddCase();
        await CreateTask(CreateController(), work.Id, "Exists", null, null);

        var result = await CreateController().Update(int.MaxValue, new CaseTaskUpdate
        {
            Title = "Missing",
            Status = nameof(CaseTaskStatus.Todo),
        });

        Assert.IsType<NotFoundResult>(result);
    }

    [Fact]
    public async Task Delete_ExistingTask_ReturnsNoContent_ThenGetByIdNotFound()
    {
        var work = await AddCase();
        var created = await CreateTask(CreateController(), work.Id, "Delete me", null, null);

        Assert.IsType<NoContentResult>(await CreateController().Delete(created.Id));
        Assert.IsType<NotFoundResult>(await CreateController().GetById(created.Id));
        Assert.NotNull(await _database.Cases.AsNoTracking().SingleOrDefaultAsync(row => row.Id == work.Id));
    }

    [Fact]
    public async Task Delete_UnknownId_ReturnsNotFound()
    {
        Assert.IsType<NotFoundResult>(await CreateController().Delete(int.MaxValue));
    }

    private TasksController CreateController() =>
        new(
            _database,
            new AiBusiness.Api.Services.CaseActivityWriter(_database),
            new FixedBusinessClock(new DateOnly(2026, 9, 27)));

    private sealed class FixedBusinessClock(DateOnly today) : IBusinessClock
    {
        public DateOnly Today { get; } = today;
        public string TimeZoneId => "Europe/Copenhagen";
    }

    private async Task<Case> AddCase(string title = "Booking page")
    {
        var customer = new Customer
        {
            Name = "Studio 22",
            Email = "studio22@example.com",
            CreatedAt = DateTime.UtcNow,
        };
        _database.Customers.Add(customer);
        await _database.SaveChangesAsync();

        var work = new Case
        {
            CustomerId = customer.Id,
            Title = title,
        };
        _database.Cases.Add(work);
        await _database.SaveChangesAsync();
        return work;
    }

    private async Task<CaseTask> CreateTask(
        TasksController controller,
        int caseId,
        string title,
        string? description,
        DateOnly? dueDate)
    {
        var result = await controller.Create(new CaseTask
        {
            CaseId = caseId,
            Title = title,
            Description = description,
            DueDate = dueDate,
        });
        var created = Assert.IsType<CreatedAtActionResult>(result);
        Assert.Equal(nameof(TasksController.GetById), created.ActionName);
        return Assert.IsType<CaseTask>(created.Value);
    }

    private async Task<CaseTask> UpdateTask(
        int id,
        string title,
        string? description,
        DateOnly? dueDate,
        CaseTaskStatus status)
    {
        var result = await CreateController().Update(id, new CaseTaskUpdate
        {
            Title = title,
            Description = description,
            DueDate = dueDate,
            Status = status.ToString(),
        });
        var ok = Assert.IsType<OkObjectResult>(result);
        return Assert.IsType<CaseTask>(ok.Value);
    }

    private async Task<CaseTask> GetTask(int id)
    {
        var result = await CreateController().GetById(id);
        var ok = Assert.IsType<OkObjectResult>(result);
        return Assert.IsType<CaseTask>(ok.Value);
    }

    private async Task<CaseTask[]> ListTasks(int? caseId = null, string? status = null)
    {
        var result = await CreateController().GetAll(caseId, status);
        var ok = Assert.IsType<OkObjectResult>(result);
        return Assert.IsType<CaseTask[]>(ok.Value);
    }
}
