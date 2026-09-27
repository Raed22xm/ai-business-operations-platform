using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using AiBusiness.Api.Data;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace AiBusiness.Api.Tests;

/// <summary>
/// Verifies the generated OpenAPI document. Uses a disposable database name that is not the
/// development database; OpenAPI generation does not query PostgreSQL.
/// </summary>
public sealed class OpenApiDocumentTests : IClassFixture<OpenApiDocumentTests.OpenApiFactory>
{
    private readonly OpenApiFactory _factory;

    public OpenApiDocumentTests(OpenApiFactory factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task Document_IsAvailable_InDevelopment()
    {
        using var client = _factory.CreateClient();
        var response = await client.GetAsync("/openapi/v1.json");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task Document_DescribesCreateLocationHeaders_AndOpenCaseDefault()
    {
        var doc = await LoadDocumentAsync();

        var customerCreate = Operation(doc, "/api/customers", "post");
        Assert.Equal("Create customer", Text(customerCreate, "summary"));
        Assert.Contains("Location", Text(customerCreate, "description"), StringComparison.OrdinalIgnoreCase);
        Assert.True(customerCreate.GetProperty("responses").TryGetProperty("201", out var createdCustomer));
        Assert.True(createdCustomer.GetProperty("headers").TryGetProperty("Location", out _));
        Assert.False(customerCreate.GetProperty("responses").TryGetProperty("200", out _));

        var caseCreate = Operation(doc, "/api/cases", "post");
        Assert.Equal("Create case", Text(caseCreate, "summary"));
        Assert.Contains("Open", Text(caseCreate, "description"), StringComparison.Ordinal);
        Assert.True(caseCreate.GetProperty("responses").TryGetProperty("201", out var createdCase));
        Assert.True(createdCase.GetProperty("headers").TryGetProperty("Location", out _));
    }

    [Fact]
    public async Task Document_DescribesProtectedUpdateFields_AndCustomerDeleteConflict()
    {
        var doc = await LoadDocumentAsync();

        var caseUpdate = Operation(doc, "/api/cases/{id}", "put");
        var updateDescription = Text(caseUpdate, "description");
        Assert.Contains("title", updateDescription, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("status", updateDescription, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("customerId", updateDescription, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("ignored", updateDescription, StringComparison.OrdinalIgnoreCase);
        Assert.True(caseUpdate.GetProperty("responses").TryGetProperty("400", out _));
        Assert.True(caseUpdate.GetProperty("responses").TryGetProperty("404", out _));

        var caseUpdateSchema = Schema(doc, "CaseUpdate");
        Assert.Contains("ignored", Text(caseUpdateSchema, "description"), StringComparison.OrdinalIgnoreCase);
        var required = RequiredNames(caseUpdateSchema);
        Assert.Contains("title", required);
        Assert.Contains("status", required);

        var customerDelete = Operation(doc, "/api/customers/{id}", "delete");
        Assert.True(customerDelete.GetProperty("responses").TryGetProperty("409", out var conflict));
        Assert.Contains("cases", Text(conflict, "description"), StringComparison.OrdinalIgnoreCase);
        Assert.True(customerDelete.GetProperty("responses").TryGetProperty("204", out _));
        Assert.True(customerDelete.GetProperty("responses").TryGetProperty("404", out _));

        var caseDelete = Operation(doc, "/api/cases/{id}", "delete");
        Assert.True(caseDelete.GetProperty("responses").TryGetProperty("409", out var caseConflict));
        Assert.Contains("tasks", Text(caseConflict, "description"), StringComparison.OrdinalIgnoreCase);

        Assert.True(doc.GetProperty("paths").TryGetProperty("/api/tasks", out _));
        Assert.True(doc.GetProperty("paths").TryGetProperty("/api/tasks/{id}", out _));
        var taskCreate = Operation(doc, "/api/tasks", "post");
        Assert.True(taskCreate.GetProperty("responses").TryGetProperty("201", out var createdTask));
        Assert.True(createdTask.GetProperty("headers").TryGetProperty("Location", out _));
        Assert.Contains("Todo", Text(taskCreate, "description"), StringComparison.Ordinal);
    }

    [Fact]
    public async Task Document_DescribesPaginationFormats_AndConstraints()
    {
        var doc = await LoadDocumentAsync();

        var customersList = Operation(doc, "/api/customers", "get");
        var customersDescription = Text(customersList, "description");
        Assert.Contains("pageSize", customersDescription, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("100", customersDescription, StringComparison.Ordinal);
        Assert.Contains("array", customersDescription, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("totalCount", customersDescription, StringComparison.OrdinalIgnoreCase);
        Assert.True(customersList.GetProperty("responses").TryGetProperty("400", out _));

        var casesList = Operation(doc, "/api/cases", "get");
        var casesDescription = Text(casesList, "description");
        Assert.Contains("Open", casesDescription, StringComparison.Ordinal);
        Assert.Contains("InProgress", casesDescription, StringComparison.Ordinal);
        Assert.Contains("Closed", casesDescription, StringComparison.Ordinal);
        Assert.Contains("customerId", casesDescription, StringComparison.OrdinalIgnoreCase);

        Assert.True(customersList.GetProperty("responses").TryGetProperty("200", out var customersOk));
        var customersSchema = customersOk.GetProperty("content").GetProperty("application/json").GetProperty("schema");
        Assert.True(customersSchema.TryGetProperty("oneOf", out var customersOneOf));
        Assert.Equal(2, customersOneOf.GetArrayLength());

        Assert.True(casesList.GetProperty("responses").TryGetProperty("200", out var casesOk));
        var casesSchema = casesOk.GetProperty("content").GetProperty("application/json").GetProperty("schema");
        Assert.True(casesSchema.TryGetProperty("oneOf", out var casesOneOf));
        Assert.Equal(2, casesOneOf.GetArrayLength());

        Assert.True(doc.GetProperty("components").GetProperty("schemas").TryGetProperty("PagedResultOfCustomer", out _)
            || doc.GetProperty("components").GetProperty("schemas").TryGetProperty("PagedCustomerResult", out _)
            || SchemaNames(doc).Any(name => name.Contains("Paged", StringComparison.OrdinalIgnoreCase)
                && name.Contains("Customer", StringComparison.OrdinalIgnoreCase)));

        Assert.True(doc.GetProperty("components").GetProperty("schemas").TryGetProperty("DashboardSummary", out _));

        var customerSchema = Schema(doc, "Customer");
        var customerRequired = RequiredNames(customerSchema);
        Assert.Contains("name", customerRequired);
        Assert.Contains("email", customerRequired);
    }

    private async Task<JsonElement> LoadDocumentAsync()
    {
        using var client = _factory.CreateClient();
        var response = await client.GetAsync("/openapi/v1.json");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var doc = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(JsonValueKind.Object, doc.ValueKind);
        return doc;
    }

    private static JsonElement Operation(JsonElement doc, string path, string method)
    {
        Assert.True(doc.GetProperty("paths").TryGetProperty(path, out var pathItem), $"Missing path {path}");
        Assert.True(pathItem.TryGetProperty(method, out var operation), $"Missing {method} {path}");
        return operation;
    }

    private static JsonElement Schema(JsonElement doc, string name)
    {
        Assert.True(
            doc.GetProperty("components").GetProperty("schemas").TryGetProperty(name, out var schema),
            $"Missing schema {name}");
        return schema;
    }

    private static IEnumerable<string> SchemaNames(JsonElement doc) =>
        doc.GetProperty("components").GetProperty("schemas").EnumerateObject().Select(property => property.Name);

    private static string Text(JsonElement element, string property) =>
        element.TryGetProperty(property, out var value) && value.ValueKind == JsonValueKind.String
            ? value.GetString() ?? ""
            : "";

    private static HashSet<string> RequiredNames(JsonElement schema)
    {
        var names = new HashSet<string>(StringComparer.Ordinal);
        if (!schema.TryGetProperty("required", out var required) || required.ValueKind != JsonValueKind.Array)
        {
            return names;
        }

        foreach (var item in required.EnumerateArray())
        {
            if (item.ValueKind == JsonValueKind.String && item.GetString() is { } name)
            {
                names.Add(name);
            }
        }

        return names;
    }

    public sealed class OpenApiFactory : WebApplicationFactory<Program>
    {
        private const string ConnectionString =
            "Host=127.0.0.1;Port=1;Database=aibusiness_openapi_doc_check;Username=openapi;Password=openapi";

        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            builder.UseSetting("ConnectionStrings:DefaultConnection", ConnectionString);
            builder.UseSetting("Auth:Username", "openapi-check");
            builder.UseSetting("Auth:Password", "openapi-check-password");
            builder.UseSetting("Auth:JwtSigningKey", "openapi-document-signing-key-32ch!");
            builder.UseEnvironment("Development");
            builder.ConfigureServices(services =>
            {
                var existing = services
                    .Where(descriptor =>
                        descriptor.ServiceType == typeof(DbContextOptions<AppDbContext>)
                        || descriptor.ServiceType == typeof(AppDbContext))
                    .ToList();
                foreach (var descriptor in existing)
                {
                    services.Remove(descriptor);
                }

                services.AddDbContext<AppDbContext>(options =>
                    options.UseNpgsql(ConnectionString));
            });
        }
    }
}
