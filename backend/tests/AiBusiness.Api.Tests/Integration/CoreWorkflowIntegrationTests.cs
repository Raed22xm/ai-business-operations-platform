using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using AiBusiness.Api.Models;

namespace AiBusiness.Api.Tests.Integration;

[Collection(PostgresIntegrationCollection.Name)]
public sealed class CoreWorkflowIntegrationTests
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        Converters = { new JsonStringEnumConverter() },
    };

    private readonly PostgresIntegrationFixture _fixture;

    public CoreWorkflowIntegrationTests(PostgresIntegrationFixture fixture)
    {
        _fixture = fixture;
    }

    [SkippableFact]
    public async Task CreateCustomer_CreateCase_RetrieveBoth()
    {
        _fixture.RequireAvailable();
        await _fixture.ResetDataAsync();
        using var client = await _fixture.CreateAuthenticatedClientAsync();
        var marker = UniqueMarker();

        var customer = await CreateCustomerAsync(client, marker, "alpha@example.com");
        var work = await CreateCaseAsync(client, customer.Id, $"{marker}-case", "created by integration");

        var customerGet = await client.GetAsync($"/api/customers/{customer.Id}");
        var caseGet = await client.GetAsync($"/api/cases/{work.Id}");

        Assert.Equal(HttpStatusCode.OK, customerGet.StatusCode);
        Assert.Equal(HttpStatusCode.OK, caseGet.StatusCode);

        var loadedCustomer = await ReadAsync<Customer>(customerGet);
        var loadedCase = await ReadAsync<Case>(caseGet);

        Assert.Equal(customer.Id, loadedCustomer.Id);
        Assert.Equal(customer.Name, loadedCustomer.Name);
        Assert.Equal(customer.Email, loadedCustomer.Email);
        Assert.Equal(work.Id, loadedCase.Id);
        Assert.Equal(customer.Id, loadedCase.CustomerId);
        Assert.Equal($"{marker}-case", loadedCase.Title);
        Assert.Equal(CaseStatus.Open, loadedCase.Status);
    }

    [SkippableFact]
    public async Task UpdateCaseStatus_ThenGet_ReturnsNewStatus()
    {
        _fixture.RequireAvailable();
        await _fixture.ResetDataAsync();
        using var client = await _fixture.CreateAuthenticatedClientAsync();
        var marker = UniqueMarker();

        var customer = await CreateCustomerAsync(client, marker, "status@example.com");
        var work = await CreateCaseAsync(client, customer.Id, $"{marker}-status", "before");

        var updateResponse = await client.PutAsJsonAsync(
            $"/api/cases/{work.Id}",
            new CaseUpdate
            {
                Title = work.Title,
                Description = work.Description,
                Status = nameof(CaseStatus.InProgress),
            });
        Assert.Equal(HttpStatusCode.OK, updateResponse.StatusCode);

        using var freshClient = await _fixture.CreateAuthenticatedClientAsync();
        var getResponse = await freshClient.GetAsync($"/api/cases/{work.Id}");
        Assert.Equal(HttpStatusCode.OK, getResponse.StatusCode);

        var loaded = await ReadAsync<Case>(getResponse);
        Assert.Equal(CaseStatus.InProgress, loaded.Status);
        Assert.Equal(work.Title, loaded.Title);
    }

    [SkippableFact]
    public async Task DeleteCustomer_WithCases_Returns409_AndPreservesRecords()
    {
        _fixture.RequireAvailable();
        await _fixture.ResetDataAsync();
        using var client = await _fixture.CreateAuthenticatedClientAsync();
        var marker = UniqueMarker();

        var customer = await CreateCustomerAsync(client, marker, "conflict@example.com");
        var work = await CreateCaseAsync(client, customer.Id, $"{marker}-keep", "must remain");

        var deleteResponse = await client.DeleteAsync($"/api/customers/{customer.Id}");
        Assert.Equal(HttpStatusCode.Conflict, deleteResponse.StatusCode);

        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync($"/api/customers/{customer.Id}")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync($"/api/cases/{work.Id}")).StatusCode);
    }

    [SkippableFact]
    public async Task DeleteCase_ThenCustomer_SubsequentGetsReturn404()
    {
        _fixture.RequireAvailable();
        await _fixture.ResetDataAsync();
        using var client = await _fixture.CreateAuthenticatedClientAsync();
        var marker = UniqueMarker();

        var customer = await CreateCustomerAsync(client, marker, "gone@example.com");
        var work = await CreateCaseAsync(client, customer.Id, $"{marker}-gone", "remove me");

        Assert.Equal(HttpStatusCode.NoContent, (await client.DeleteAsync($"/api/cases/{work.Id}")).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await client.DeleteAsync($"/api/customers/{customer.Id}")).StatusCode);

        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync($"/api/cases/{work.Id}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync($"/api/customers/{customer.Id}")).StatusCode);
    }

    [SkippableFact]
    public async Task Search_CombinedCaseFilters_AndPagination_ReturnCorrectTotals()
    {
        _fixture.RequireAvailable();
        await _fixture.ResetDataAsync();
        using var client = await _fixture.CreateAuthenticatedClientAsync();
        var marker = UniqueMarker();

        var first = await CreateCustomerAsync(client, $"{marker}-one", $"{marker}-one@example.com", "Alpha Co");
        var second = await CreateCustomerAsync(client, $"{marker}-two", $"{marker}-two@example.com", "Beta Co");

        var openMatch = await CreateCaseAsync(client, first.Id, $"{marker}-needle open", "keep");
        await CreateCaseAsync(client, first.Id, $"{marker}-other", "no match");
        var closedMatch = await CreateCaseAsync(client, first.Id, $"{marker}-needle closed", "keep");
        await PutStatusAsync(client, closedMatch.Id, closedMatch.Title, closedMatch.Description, CaseStatus.Closed);
        await CreateCaseAsync(client, second.Id, $"{marker}-needle elsewhere", "wrong customer");

        var customerSearch = await client.GetAsync($"/api/customers?search={Uri.EscapeDataString(marker)}&page=1&pageSize=10");
        Assert.Equal(HttpStatusCode.OK, customerSearch.StatusCode);
        var customersPage = await ReadAsync<PagedResult<Customer>>(customerSearch);
        Assert.Equal(2, customersPage.TotalCount);
        Assert.Equal(2, customersPage.Items.Length);

        var combined = await client.GetAsync(
            $"/api/cases?customerId={first.Id}&status=Open&search={Uri.EscapeDataString(marker + "-needle")}&page=1&pageSize=10");
        Assert.Equal(HttpStatusCode.OK, combined.StatusCode);
        var casesPage = await ReadAsync<PagedResult<Case>>(combined);
        Assert.Equal(1, casesPage.TotalCount);
        Assert.Single(casesPage.Items);
        Assert.Equal(openMatch.Id, casesPage.Items[0].Id);

        for (var index = 0; index < 5; index++)
        {
            await CreateCustomerAsync(
                client,
                $"{marker}-page-{index}",
                $"{marker}-page-{index}@example.com");
        }

        var pageOne = await ReadAsync<PagedResult<Customer>>(
            await client.GetAsync($"/api/customers?search={Uri.EscapeDataString(marker)}&page=1&pageSize=3"));
        var pageTwo = await ReadAsync<PagedResult<Customer>>(
            await client.GetAsync($"/api/customers?search={Uri.EscapeDataString(marker)}&page=2&pageSize=3"));

        Assert.Equal(7, pageOne.TotalCount);
        Assert.Equal(3, pageOne.Items.Length);
        Assert.Equal(7, pageTwo.TotalCount);
        Assert.Equal(3, pageTwo.Items.Length);
        Assert.Empty(pageOne.Items.Select(item => item.Id).Intersect(pageTwo.Items.Select(item => item.Id)));
    }

    [SkippableFact]
    public async Task InvalidInput_Returns400_WithoutChangingSavedData()
    {
        _fixture.RequireAvailable();
        await _fixture.ResetDataAsync();
        using var client = await _fixture.CreateAuthenticatedClientAsync();
        var marker = UniqueMarker();

        var customer = await CreateCustomerAsync(client, marker, "valid@example.com", "Keep Co");
        var work = await CreateCaseAsync(client, customer.Id, $"{marker}-valid", "keep description");

        var badCustomer = await client.PostAsJsonAsync(
            "/api/customers",
            new Customer { Name = "", Email = "bad@example.com" });
        Assert.Equal(HttpStatusCode.BadRequest, badCustomer.StatusCode);

        var badCase = await client.PostAsJsonAsync(
            "/api/cases",
            new Case { CustomerId = customer.Id, Title = "", Description = "nope" });
        Assert.Equal(HttpStatusCode.BadRequest, badCase.StatusCode);

        var badUpdate = await client.PutAsJsonAsync(
            $"/api/cases/{work.Id}",
            new CaseUpdate
            {
                Title = work.Title,
                Description = work.Description,
                Status = "NotARealStatus",
            });
        Assert.Equal(HttpStatusCode.BadRequest, badUpdate.StatusCode);

        var badPage = await client.GetAsync("/api/customers?page=0&pageSize=20");
        Assert.Equal(HttpStatusCode.BadRequest, badPage.StatusCode);

        var loadedCustomer = await ReadAsync<Customer>(await client.GetAsync($"/api/customers/{customer.Id}"));
        var loadedCase = await ReadAsync<Case>(await client.GetAsync($"/api/cases/{work.Id}"));
        var allCustomers = await ReadAsync<Customer[]>(await client.GetAsync("/api/customers"));
        var allCases = await ReadAsync<Case[]>(await client.GetAsync("/api/cases"));

        Assert.Equal(customer.Name, loadedCustomer.Name);
        Assert.Equal(customer.Email, loadedCustomer.Email);
        Assert.Equal("Keep Co", loadedCustomer.Company);
        Assert.Equal(work.Title, loadedCase.Title);
        Assert.Equal(CaseStatus.Open, loadedCase.Status);
        Assert.Single(allCustomers);
        Assert.Single(allCases);
    }

    private static string UniqueMarker() => $"it-{Guid.NewGuid():N}".Substring(0, 16);

    private static async Task<Customer> CreateCustomerAsync(
        HttpClient client,
        string name,
        string email,
        string? company = null)
    {
        var response = await client.PostAsJsonAsync(
            "/api/customers",
            new Customer
            {
                Name = name,
                Email = email,
                Company = company,
            });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return await ReadAsync<Customer>(response);
    }

    private static async Task<Case> CreateCaseAsync(
        HttpClient client,
        int customerId,
        string title,
        string? description)
    {
        var response = await client.PostAsJsonAsync(
            "/api/cases",
            new Case
            {
                CustomerId = customerId,
                Title = title,
                Description = description,
            });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return await ReadAsync<Case>(response);
    }

    private static async Task PutStatusAsync(
        HttpClient client,
        int id,
        string title,
        string? description,
        CaseStatus status)
    {
        var response = await client.PutAsJsonAsync(
            $"/api/cases/{id}",
            new CaseUpdate
            {
                Title = title,
                Description = description,
                Status = status.ToString(),
            });
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    private static async Task<T> ReadAsync<T>(HttpResponseMessage response)
    {
        var body = await response.Content.ReadAsStringAsync();
        var value = JsonSerializer.Deserialize<T>(body, JsonOptions);
        Assert.NotNull(value);
        return value;
    }
}
