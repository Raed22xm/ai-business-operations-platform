using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using AiBusiness.Api.Models;

namespace AiBusiness.Api.Tests.Integration;

[Collection(PostgresIntegrationCollection.Name)]
public sealed class TaskWorkflowIntegrationTests
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        Converters = { new JsonStringEnumConverter() },
    };

    private readonly PostgresIntegrationFixture _fixture;

    public TaskWorkflowIntegrationTests(PostgresIntegrationFixture fixture)
    {
        _fixture = fixture;
    }

    [SkippableFact]
    public async Task CreateTask_UpdateStatus_Filter_AndDeleteConflict_OverHttp()
    {
        _fixture.RequireAvailable();
        await _fixture.ResetDataAsync();
        using var client = await _fixture.CreateAuthenticatedClientAsync();
        var marker = $"task-{Guid.NewGuid():N}"[..12];

        var customerResponse = await client.PostAsJsonAsync(
            "/api/customers",
            new Customer { Name = $"{marker}-cust", Email = $"{marker}@example.com" });
        Assert.Equal(HttpStatusCode.Created, customerResponse.StatusCode);
        var customer = await ReadAsync<Customer>(customerResponse);

        var caseResponse = await client.PostAsJsonAsync(
            "/api/cases",
            new Case { CustomerId = customer.Id, Title = $"{marker}-case", Description = "for tasks" });
        Assert.Equal(HttpStatusCode.Created, caseResponse.StatusCode);
        Assert.NotNull(caseResponse.Headers.Location);
        var work = await ReadAsync<Case>(caseResponse);

        var createTask = await client.PostAsJsonAsync(
            "/api/tasks",
            new CaseTask
            {
                CaseId = work.Id,
                Title = $"{marker}-design",
                Description = "Wireframes",
                DueDate = new DateOnly(2026, 10, 15),
                Status = CaseTaskStatus.Done,
                Id = 999,
            });
        Assert.Equal(HttpStatusCode.Created, createTask.StatusCode);
        Assert.NotNull(createTask.Headers.Location);
        var task = await ReadAsync<CaseTask>(createTask);
        Assert.Equal(CaseTaskStatus.Todo, task.Status);
        Assert.NotEqual(999, task.Id);

        var getTask = await client.GetAsync($"/api/tasks/{task.Id}");
        Assert.Equal(HttpStatusCode.OK, getTask.StatusCode);

        var update = await client.PutAsJsonAsync(
            $"/api/tasks/{task.Id}",
            new CaseTaskUpdate
            {
                Title = $"{marker}-design",
                Description = null,
                DueDate = null,
                Status = nameof(CaseTaskStatus.InProgress),
                CaseId = customer.Id,
            });
        Assert.Equal(HttpStatusCode.OK, update.StatusCode);
        var updated = await ReadAsync<CaseTask>(update);
        Assert.Equal(CaseTaskStatus.InProgress, updated.Status);
        Assert.Null(updated.Description);
        Assert.Null(updated.DueDate);
        Assert.Equal(work.Id, updated.CaseId);

        var filtered = await client.GetAsync(
            $"/api/tasks?caseId={work.Id}&status=InProgress");
        Assert.Equal(HttpStatusCode.OK, filtered.StatusCode);
        var list = await ReadAsync<CaseTask[]>(filtered);
        Assert.Single(list);
        Assert.Equal(task.Id, list[0].Id);

        var conflict = await client.DeleteAsync($"/api/cases/{work.Id}");
        Assert.Equal(HttpStatusCode.Conflict, conflict.StatusCode);
        var problem = await conflict.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(
            "This case has tasks and cannot be deleted.",
            problem.GetProperty("detail").GetString());

        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync($"/api/cases/{work.Id}")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync($"/api/tasks/{task.Id}")).StatusCode);

        Assert.Equal(HttpStatusCode.NoContent, (await client.DeleteAsync($"/api/tasks/{task.Id}")).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await client.DeleteAsync($"/api/cases/{work.Id}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync($"/api/tasks/{task.Id}")).StatusCode);
    }

    private static async Task<T> ReadAsync<T>(HttpResponseMessage response)
    {
        var body = await response.Content.ReadAsStringAsync();
        var value = JsonSerializer.Deserialize<T>(body, JsonOptions);
        Assert.NotNull(value);
        return value;
    }
}
