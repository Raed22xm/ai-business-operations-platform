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

public class CaseTemplateTests : IDisposable
{
    private readonly SqliteConnection _connection;
    private readonly AppDbContext _database;

    public CaseTemplateTests()
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
    public async Task Create_StoresOrderedTasks_DefaultsAndTrims()
    {
        var result = await Templates().Create(new CaseTemplateWrite
        {
            Name = "  Website kickoff  ",
            Description = "  Starter pack  ",
            TaskTitles = ["  Discover  ", "Design", "Launch"],
        });

        var created = Assert.IsType<CreatedAtActionResult>(result);
        var template = Assert.IsType<CaseTemplate>(created.Value);
        Assert.True(template.Id > 0);
        Assert.Equal("Website kickoff", template.Name);
        Assert.Equal("Starter pack", template.Description);
        Assert.Equal(
            new[] { "Discover", "Design", "Launch" },
            template.Tasks.Select(task => task.Title).ToArray());
        Assert.Equal(new[] { 0, 1, 2 }, template.Tasks.Select(task => task.SortOrder).ToArray());
        Assert.True(template.CreatedAt <= DateTime.UtcNow.AddSeconds(2));
        Assert.True(template.CreatedAt >= DateTime.UtcNow.AddMinutes(-1));
    }

    [Fact]
    public async Task Create_ValidationRejectsBlankName_TooManyTasks_AndBlankTitles()
    {
        AssertValidationProblem(
            await Templates().Create(new CaseTemplateWrite { Name = "  ", TaskTitles = [] }),
            nameof(CaseTemplateWrite.Name));
        AssertValidationProblem(
            await Templates().Create(new CaseTemplateWrite
            {
                Name = "Too many",
                TaskTitles = Enumerable.Range(1, 51).Select(i => $"Task {i}").ToList(),
            }),
            nameof(CaseTemplateWrite.TaskTitles));
        AssertValidationProblem(
            await Templates().Create(new CaseTemplateWrite
            {
                Name = "Blank task",
                TaskTitles = ["Ok", "   "],
            }),
            $"{nameof(CaseTemplateWrite.TaskTitles)}[1]");
        Assert.Equal(0, await _database.CaseTemplates.CountAsync());
    }

    [Fact]
    public async Task Update_ReplacesTaskList_WithoutTouchingCreatedCases()
    {
        var created = Assert.IsType<CaseTemplate>(
            Assert.IsType<CreatedAtActionResult>(
                await Templates().Create(new CaseTemplateWrite
                {
                    Name = "Onboarding",
                    TaskTitles = ["A", "B"],
                })).Value);

        var customer = await AddCustomer();
        var fromTemplate = await Cases().CreateFromTemplate(new CreateCaseFromTemplateRequest
        {
            CustomerId = customer.Id,
            Title = "Copied case",
            Description = "From template snapshot",
            TaskTitles = ["A", "B"],
        });
        var createdCase = Assert.IsType<CaseFromTemplateResult>(
            Assert.IsType<CreatedAtActionResult>(fromTemplate).Value);

        var updated = Assert.IsType<CaseTemplate>(
            Assert.IsType<OkObjectResult>(
                await Templates().Update(created.Id, new CaseTemplateWrite
                {
                    Name = "Onboarding v2",
                    Description = "Changed",
                    TaskTitles = ["Only X"],
                })).Value);

        Assert.Equal("Onboarding v2", updated.Name);
        Assert.Equal(new[] { "Only X" }, updated.Tasks.Select(task => task.Title).ToArray());

        var work = await _database.Cases.FindAsync(createdCase.Case.Id);
        Assert.NotNull(work);
        Assert.Equal("Copied case", work.Title);
        Assert.Equal("From template snapshot", work.Description);
        var taskTitles = await _database.CaseTasks
            .Where(task => task.CaseId == work.Id)
            .OrderBy(task => task.Id)
            .Select(task => task.Title)
            .ToArrayAsync();
        Assert.Equal(new[] { "A", "B" }, taskTitles);
    }

    [Fact]
    public async Task Delete_RemovesTemplateOnly_LeavesCasesIntact()
    {
        var created = Assert.IsType<CaseTemplate>(
            Assert.IsType<CreatedAtActionResult>(
                await Templates().Create(new CaseTemplateWrite
                {
                    Name = "Delete me",
                    TaskTitles = ["One"],
                })).Value);
        var customer = await AddCustomer();
        var fromTemplate = Assert.IsType<CaseFromTemplateResult>(
            Assert.IsType<CreatedAtActionResult>(
                await Cases().CreateFromTemplate(new CreateCaseFromTemplateRequest
                {
                    CustomerId = customer.Id,
                    Title = "Independent case",
                    TaskTitles = ["One"],
                })).Value);

        var deleted = await Templates().Delete(created.Id);
        Assert.IsType<NoContentResult>(deleted);
        Assert.Null(await _database.CaseTemplates.FindAsync(created.Id));
        Assert.Equal(0, await _database.CaseTemplateTasks.CountAsync());

        Assert.NotNull(await _database.Cases.FindAsync(fromTemplate.Case.Id));
        Assert.Equal(1, await _database.CaseTasks.CountAsync(task => task.CaseId == fromTemplate.Case.Id));
    }

    [Fact]
    public async Task CreateFromTemplate_CreatesOpenCase_TodoNormalTasks_InTransaction()
    {
        var customer = await AddCustomer();
        SetActor(Cases(), "workspace-user");

        var result = await Cases().CreateFromTemplate(new CreateCaseFromTemplateRequest
        {
            CustomerId = customer.Id,
            Title = "  Launch site  ",
            Description = "  Scope  ",
            TaskTitles = ["  Wireframe  ", "Ship"],
        });

        var created = Assert.IsType<CreatedAtActionResult>(result);
        var body = Assert.IsType<CaseFromTemplateResult>(created.Value);
        Assert.Equal(CaseStatus.Open, body.Case.Status);
        Assert.Null(body.Case.ArchivedAt);
        Assert.Equal("Launch site", body.Case.Title);
        Assert.Equal("Scope", body.Case.Description);
        Assert.Equal(2, body.Tasks.Count);
        Assert.All(body.Tasks, task =>
        {
            Assert.Equal(CaseTaskStatus.Todo, task.Status);
            Assert.Equal(CaseTaskPriority.Normal, task.Priority);
            Assert.Null(task.DueDate);
            Assert.Null(task.Description);
            Assert.Equal(body.Case.Id, task.CaseId);
        });
        Assert.Equal(new[] { "Wireframe", "Ship" }, body.Tasks.Select(task => task.Title).ToArray());

        var activities = await _database.CaseActivities
            .Where(activity => activity.CaseId == body.Case.Id)
            .OrderBy(activity => activity.Id)
            .ToArrayAsync();
        Assert.Contains(activities, activity => activity.EventType == CaseActivityEventType.CaseCreated);
        Assert.Equal(2, activities.Count(activity => activity.EventType == CaseActivityEventType.TaskCreated));
    }

    [Fact]
    public async Task CreateFromTemplate_UnknownCustomer_Returns400_WithoutWriting()
    {
        var result = await Cases().CreateFromTemplate(new CreateCaseFromTemplateRequest
        {
            CustomerId = 999,
            Title = "Orphan",
            TaskTitles = ["A"],
        });
        AssertValidationProblem(result, nameof(Case.CustomerId));
        Assert.Equal(0, await _database.Cases.CountAsync());
        Assert.Equal(0, await _database.CaseTasks.CountAsync());
    }

    [Fact]
    public async Task CreateFromTemplate_InvalidTaskTitle_RollsBackEntirely()
    {
        var customer = await AddCustomer();
        var result = await Cases().CreateFromTemplate(new CreateCaseFromTemplateRequest
        {
            CustomerId = customer.Id,
            Title = "Valid case",
            TaskTitles = ["Ok", ""],
        });
        AssertValidationProblem(result, $"{nameof(CreateCaseFromTemplateRequest.TaskTitles)}[1]");
        Assert.Equal(0, await _database.Cases.CountAsync());
        Assert.Equal(0, await _database.CaseTasks.CountAsync());
        Assert.Equal(0, await _database.CaseActivities.CountAsync());
    }

    private CaseTemplatesController Templates()
    {
        var controller = new CaseTemplatesController(_database);
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext(),
        };
        return controller;
    }

    private CasesController Cases()
    {
        var controller = new CasesController(
            _database,
            new CaseActivityWriter(_database),
            TestCsvExport.Service());
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext(),
        };
        return controller;
    }

    private async Task<Customer> AddCustomer()
    {
        var customer = new Customer
        {
            Name = "Template Customer",
            Email = $"template-{Guid.NewGuid():N}@example.com",
        };
        _database.Customers.Add(customer);
        await _database.SaveChangesAsync();
        return customer;
    }

    private static void SetActor(ControllerBase controller, string name)
    {
        var identity = new ClaimsIdentity(
            [new Claim(ClaimTypes.Name, name)],
            authenticationType: "Test");
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext
            {
                User = new ClaimsPrincipal(identity),
            },
        };
    }

    private static void AssertValidationProblem(IActionResult result, string key)
    {
        var objectResult = Assert.IsAssignableFrom<ObjectResult>(result);
        var problem = Assert.IsType<ValidationProblemDetails>(objectResult.Value);
        Assert.True(problem.Errors.ContainsKey(key), $"Expected validation key '{key}'.");
        Assert.NotEmpty(problem.Errors[key]);
    }
}
