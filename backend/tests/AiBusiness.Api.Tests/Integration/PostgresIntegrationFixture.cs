using System.Net.Http.Json;
using AiBusiness.Api.Data;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Testcontainers.PostgreSql;


namespace AiBusiness.Api.Tests.Integration;

public sealed class PostgresIntegrationFixture : IAsyncLifetime
{
    private PostgreSqlContainer? _container;
    private ApiWebApplicationFactory? _factory;

    public bool IsAvailable { get; private set; }

    public string UnavailableReason { get; private set; } = "PostgreSQL integration environment was not initialized.";

    public HttpClient CreateClient()
    {
        RequireAvailable();
        return _factory!.CreateClient();
    }

    public async Task<HttpClient> CreateAuthenticatedClientAsync()
    {
        RequireAvailable();
        var client = _factory!.CreateClient();
        var login = await client.PostAsJsonAsync(
            "/api/auth/login",
            new { username = ApiWebApplicationFactory.TestUsername, password = ApiWebApplicationFactory.TestPassword });
        login.EnsureSuccessStatusCode();
        var body = await login.Content.ReadFromJsonAsync<LoginTokenResponse>(
            new System.Text.Json.JsonSerializerOptions { PropertyNameCaseInsensitive = true });
        if (body is null || string.IsNullOrWhiteSpace(body.AccessToken))
        {
            throw new InvalidOperationException("Login did not return an access token.");
        }

        client.DefaultRequestHeaders.Authorization =
            new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", body.AccessToken);
        return client;
    }

    private sealed record LoginTokenResponse(string AccessToken);

    public async Task ResetDataAsync()
    {
        RequireAvailable();
        DevelopmentConnectionGuard.EnsureNotDevelopmentDatabase(_factory!.ConnectionString);

        await using var scope = _factory.Services.CreateAsyncScope();
        var database = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        await database.Database.ExecuteSqlRawAsync(
            """TRUNCATE TABLE "CaseActivities", "CaseTasks", "Cases", "Customers" RESTART IDENTITY CASCADE;""");
    }

    public void RequireAvailable()
    {
        Skip.If(!IsAvailable, UnavailableReason);
    }

    public async Task InitializeAsync()
    {
        try
        {
            _container = new PostgreSqlBuilder("postgres:16-alpine")
                .WithDatabase("aibusiness_integration_tests")
                .WithUsername("aibusiness_test")
                .WithPassword("integration-test-only")
                .Build();

            await _container.StartAsync();

            var connectionString = _container.GetConnectionString();
            DevelopmentConnectionGuard.EnsureNotDevelopmentDatabase(connectionString);

            _factory = new ApiWebApplicationFactory(connectionString);
            await using (var scope = _factory.Services.CreateAsyncScope())
            {
                var database = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                await database.Database.MigrateAsync();
            }

            IsAvailable = true;
            UnavailableReason = string.Empty;
        }
        catch (Exception exception)
        {
            IsAvailable = false;
            UnavailableReason =
                "PostgreSQL integration suite not run: could not start a disposable test database. "
                + "Docker must be available. Details: "
                + exception.Message;

            if (_factory is not null)
            {
                await _factory.DisposeAsync();
                _factory = null;
            }

            if (_container is not null)
            {
                await _container.DisposeAsync();
                _container = null;
            }
        }
    }

    public async Task DisposeAsync()
    {
        if (_factory is not null)
        {
            await _factory.DisposeAsync();
            _factory = null;
        }

        if (_container is not null)
        {
            await _container.DisposeAsync();
            _container = null;
        }
    }
}

public sealed class ApiWebApplicationFactory : WebApplicationFactory<Program>
{
    public const string TestUsername = "e2e-workspace";
    public const string TestPassword = "e2e-workspace-password";
    public const string TestSigningKey = "e2e-integration-signing-key-32chars!";

    public ApiWebApplicationFactory(string connectionString)
    {
        ConnectionString = connectionString;
    }

    public string ConnectionString { get; }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        DevelopmentConnectionGuard.EnsureNotDevelopmentDatabase(ConnectionString);

        builder.UseSetting("ConnectionStrings:DefaultConnection", ConnectionString);
        builder.UseSetting("Auth:Username", TestUsername);
        builder.UseSetting("Auth:Password", TestPassword);
        builder.UseSetting("Auth:JwtSigningKey", TestSigningKey);
        builder.UseSetting("Auth:JwtIssuer", "AiBusiness.Api");
        builder.UseSetting("Auth:JwtAudience", "AiBusiness.Frontend");
        builder.UseSetting("Auth:JwtExpirationMinutes", "120");
        builder.UseSetting("RateLimiting:Assistant:PermitLimit", "3");
        builder.UseSetting("RateLimiting:Assistant:WindowSeconds", "60");
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

[CollectionDefinition(Name)]
public sealed class PostgresIntegrationCollection : ICollectionFixture<PostgresIntegrationFixture>
{
    public const string Name = "postgres-integration";
}
