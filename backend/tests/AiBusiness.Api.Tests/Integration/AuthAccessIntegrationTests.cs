using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;

namespace AiBusiness.Api.Tests.Integration;

[Collection(PostgresIntegrationCollection.Name)]
public sealed class AuthAccessIntegrationTests
{
    private readonly PostgresIntegrationFixture _fixture;

    public AuthAccessIntegrationTests(PostgresIntegrationFixture fixture)
    {
        _fixture = fixture;
    }

    [SkippableFact]
    public async Task Health_AllowsAnonymous()
    {
        _fixture.RequireAvailable();
        using var client = _fixture.CreateClient();

        var response = await client.GetAsync("/api/health");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [SkippableFact]
    public async Task ProtectedEndpoints_WithoutToken_ReturnUnauthorized()
    {
        _fixture.RequireAvailable();
        using var client = _fixture.CreateClient();

        var paths = new[]
        {
            "/api/customers",
            "/api/customers/export",
            "/api/cases",
            "/api/cases/export",
            "/api/tasks",
            "/api/tasks/search",
            "/api/dashboard/summary",
            "/api/assistant/cases/1/summary",
            "/api/assistant/cases/1/draft-response",
            "/api/cases/1/activity",
            "/api/cases/1/archive",
            "/api/cases/1/restore",
            "/api/customers/1/notes",
        };

        foreach (var path in paths)
        {
            HttpResponseMessage response =
                path.Contains("/assistant/", StringComparison.Ordinal)
                || path.EndsWith("/archive", StringComparison.Ordinal)
                || path.EndsWith("/restore", StringComparison.Ordinal)
                    ? await client.PostAsync(path, null)
                    : await client.GetAsync(path);
            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        }
    }

    [SkippableFact]
    public async Task Login_WithValidCredentials_ThenAccessCustomers()
    {
        _fixture.RequireAvailable();
        await _fixture.ResetDataAsync();
        using var client = await _fixture.CreateAuthenticatedClientAsync();

        var response = await client.GetAsync("/api/customers");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [SkippableFact]
    public async Task Login_WithInvalidPassword_ReturnsUnauthorized()
    {
        _fixture.RequireAvailable();
        using var client = _fixture.CreateClient();

        var response = await client.PostAsJsonAsync(
            "/api/auth/login",
            new { username = ApiWebApplicationFactory.TestUsername, password = "wrong-password" });

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        var body = await response.Content.ReadAsStringAsync();
        Assert.DoesNotContain(ApiWebApplicationFactory.TestPassword, body, StringComparison.Ordinal);
        Assert.DoesNotContain(ApiWebApplicationFactory.TestSigningKey, body, StringComparison.Ordinal);
    }

    [SkippableFact]
    public async Task ExpiredToken_ReturnsUnauthorized()
    {
        _fixture.RequireAvailable();
        using var client = _fixture.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJleHBpcmVkIiwiZXhwIjoxfQ.invalid");

        var response = await client.GetAsync("/api/customers");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [SkippableFact]
    public async Task Logout_ReturnsNoContent()
    {
        _fixture.RequireAvailable();
        using var client = _fixture.CreateClient();

        var response = await client.PostAsync("/api/auth/logout", null);

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
    }

    [SkippableFact]
    public async Task Assistant_ExceedsRateLimit_Returns429()
    {
        _fixture.RequireAvailable();
        await _fixture.ResetDataAsync();
        using var client = await _fixture.CreateAuthenticatedClientAsync();

        var customerResponse = await client.PostAsJsonAsync(
            "/api/customers",
            new { name = "Rate Limit Customer", email = $"rate.{Guid.NewGuid():N}@example.com" });
        customerResponse.EnsureSuccessStatusCode();
        using var customerDoc = JsonDocument.Parse(await customerResponse.Content.ReadAsStringAsync());
        var customerId = customerDoc.RootElement.GetProperty("id").GetInt32();

        var caseResponse = await client.PostAsJsonAsync(
            "/api/cases",
            new { customerId, title = "Rate limit case", description = "Disposable" });
        caseResponse.EnsureSuccessStatusCode();
        using var caseDoc = JsonDocument.Parse(await caseResponse.Content.ReadAsStringAsync());
        var caseId = caseDoc.RootElement.GetProperty("id").GetInt32();

        HttpStatusCode? last = null;
        for (var i = 0; i < 5; i++)
        {
            var response = await client.PostAsync($"/api/assistant/cases/{caseId}/summary", null);
            last = response.StatusCode;
            if (response.StatusCode == HttpStatusCode.TooManyRequests)
            {
                var body = await response.Content.ReadAsStringAsync();
                Assert.Contains("Too many AI requests", body, StringComparison.OrdinalIgnoreCase);
                return;
            }
        }

        Assert.Fail($"Expected HTTP 429 after repeated assistant calls; last status was {last}.");
    }
}
