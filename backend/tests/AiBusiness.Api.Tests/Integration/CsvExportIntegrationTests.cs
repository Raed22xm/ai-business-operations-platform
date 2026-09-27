using System.Net;
using System.Net.Http.Json;
using System.Text;
using AiBusiness.Api.Models;

namespace AiBusiness.Api.Tests.Integration;

[Collection(PostgresIntegrationCollection.Name)]
public sealed class CsvExportIntegrationTests
{
    private readonly PostgresIntegrationFixture _fixture;

    public CsvExportIntegrationTests(PostgresIntegrationFixture fixture)
    {
        _fixture = fixture;
    }

    [SkippableFact]
    public async Task ExportEndpoints_WithoutToken_ReturnUnauthorized()
    {
        _fixture.RequireAvailable();
        using var client = _fixture.CreateClient();

        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/api/customers/export")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/api/cases/export")).StatusCode);
    }

    [SkippableFact]
    public async Task CustomerExport_RespectsSearch_AndDoesNotMutate()
    {
        _fixture.RequireAvailable();
        await _fixture.ResetDataAsync();
        using var client = await _fixture.CreateAuthenticatedClientAsync();

        var marker = $"csv-{Guid.NewGuid():N}";
        for (var i = 0; i < 3; i++)
        {
            await client.PostAsJsonAsync(
                "/api/customers",
                new { name = $"{marker} {i}", email = $"{marker}{i}@example.com", phone = (string?)null, company = (string?)null });
        }

        await client.PostAsJsonAsync(
            "/api/customers",
            new
            {
                name = "Unrelated Person",
                email = $"unrelated-{Guid.NewGuid():N}@example.com",
                phone = (string?)null,
                company = (string?)null,
            });

        var before = await client.GetAsync($"/api/customers?search={Uri.EscapeDataString(marker)}");
        before.EnsureSuccessStatusCode();
        var listed = await before.Content.ReadFromJsonAsync<Customer[]>();
        Assert.NotNull(listed);
        Assert.Equal(3, listed.Length);

        var export = await client.GetAsync($"/api/customers/export?search={Uri.EscapeDataString(marker)}");
        Assert.Equal(HttpStatusCode.OK, export.StatusCode);
        Assert.Equal("text/csv", export.Content.Headers.ContentType?.MediaType);
        var fileName = export.Content.Headers.ContentDisposition?.FileNameStar
            ?? export.Content.Headers.ContentDisposition?.FileName
            ?? "";
        Assert.Contains("customers-", fileName, StringComparison.Ordinal);

        var bytes = await export.Content.ReadAsByteArrayAsync();
        var text = Encoding.UTF8.GetString(bytes).TrimStart('\uFEFF');
        Assert.Contains("Id,Name,Email,Phone,Company,Created At (UTC)", text);
        Assert.Contains($"{marker} 0", text);
        Assert.Contains($"{marker} 2", text);
        Assert.DoesNotContain("Unrelated", text);

        var after = await client.GetAsync($"/api/customers?search={Uri.EscapeDataString(marker)}");
        after.EnsureSuccessStatusCode();
        var listedAfter = await after.Content.ReadFromJsonAsync<Customer[]>();
        Assert.NotNull(listedAfter);
        Assert.Equal(3, listedAfter.Length);
    }

    [SkippableFact]
    public async Task CaseExport_RespectsFilters_AndIncludesCustomerName()
    {
        _fixture.RequireAvailable();
        await _fixture.ResetDataAsync();
        using var client = await _fixture.CreateAuthenticatedClientAsync();

        var customerResponse = await client.PostAsJsonAsync(
            "/api/customers",
            new { name = "Export Studio", email = $"export.studio.{Guid.NewGuid():N}@example.com", phone = (string?)null, company = (string?)null });
        customerResponse.EnsureSuccessStatusCode();
        var customer = await customerResponse.Content.ReadFromJsonAsync<Customer>();
        Assert.NotNull(customer);

        var otherResponse = await client.PostAsJsonAsync(
            "/api/customers",
            new { name = "Other Studio", email = $"other.studio.{Guid.NewGuid():N}@example.com", phone = (string?)null, company = (string?)null });
        otherResponse.EnsureSuccessStatusCode();
        var other = await otherResponse.Content.ReadFromJsonAsync<Customer>();
        Assert.NotNull(other);

        var marker = $"case-csv-{Guid.NewGuid():N}";
        await client.PostAsJsonAsync("/api/cases", new { customerId = customer.Id, title = $"{marker} keep", description = "keep me" });
        await client.PostAsJsonAsync("/api/cases", new { customerId = other.Id, title = $"{marker} other", description = "skip" });

        var export = await client.GetAsync(
            $"/api/cases/export?customerId={customer.Id}&search={Uri.EscapeDataString(marker)}");
        Assert.Equal(HttpStatusCode.OK, export.StatusCode);
        var text = Encoding.UTF8.GetString(await export.Content.ReadAsByteArrayAsync()).TrimStart('\uFEFF');
        Assert.Contains("Id,Customer Id,Customer Name,Title,Description,Status,Created At (UTC)", text);
        Assert.Contains("Export Studio", text);
        Assert.Contains($"{marker} keep", text);
        Assert.DoesNotContain("Other Studio", text);
        Assert.DoesNotContain($"{marker} other", text);
    }
}
