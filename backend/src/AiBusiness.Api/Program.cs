using System.Text;
using System.Threading.RateLimiting;
using AiBusiness.Api;
using AiBusiness.Api.Data;
using AiBusiness.Api.Options;
using AiBusiness.Api.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

var builder = WebApplication.CreateBuilder(args);

var rawConnectionString = builder.Configuration.GetConnectionString("DefaultConnection");
if (string.IsNullOrWhiteSpace(rawConnectionString))
{
    throw new InvalidOperationException(
        "Missing connection string 'DefaultConnection'. Set it with dotnet user-secrets or the ConnectionStrings__DefaultConnection environment variable.");
}
var connectionString = NormalizePostgresConnectionString(rawConnectionString);

builder.Services.AddControllers();
builder.Services.AddOpenApi(options => options.AddCrmDocumentation());
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(connectionString));

builder.Services.Configure<OpenAiOptions>(
    builder.Configuration.GetSection(OpenAiOptions.SectionName));
builder.Services.Configure<AuthOptions>(
    builder.Configuration.GetSection(AuthOptions.SectionName));
builder.Services.Configure<AssistantRateLimitOptions>(
    builder.Configuration.GetSection(AssistantRateLimitOptions.SectionName));

var openAiOptions = builder.Configuration
    .GetSection(OpenAiOptions.SectionName)
    .Get<OpenAiOptions>() ?? new OpenAiOptions();

var openAiModel = string.IsNullOrWhiteSpace(openAiOptions.Model)
    ? "gpt-4o-mini"
    : openAiOptions.Model.Trim();
var timeoutSeconds = openAiOptions.TimeoutSeconds <= 0 ? 30 : openAiOptions.TimeoutSeconds;

if (string.IsNullOrWhiteSpace(openAiOptions.ApiKey))
{
    builder.Services.AddSingleton<IOpenAiClient>(_ => new MockOpenAiClient(openAiModel));
}
else
{
    builder.Services.AddHttpClient<IOpenAiClient, OpenAiHttpClient>((_, client) =>
    {
        var baseUrl = string.IsNullOrWhiteSpace(openAiOptions.BaseUrl)
            ? "https://api.openai.com/v1"
            : openAiOptions.BaseUrl.Trim().TrimEnd('/');
        client.BaseAddress = new Uri(baseUrl + "/");
        client.Timeout = TimeSpan.FromSeconds(timeoutSeconds);
    });
}

builder.Services.Configure<BusinessTimezoneOptions>(
    builder.Configuration.GetSection(BusinessTimezoneOptions.SectionName));
builder.Services.Configure<CsvExportOptions>(
    builder.Configuration.GetSection(CsvExportOptions.SectionName));
builder.Services.AddSingleton<IBusinessClock, BusinessClock>();
builder.Services.AddSingleton<CsvExportService>();
builder.Services.AddScoped<CaseActivityWriter>();
builder.Services.AddScoped<CaseAssistantService>();
builder.Services.AddScoped<CaseEscalationService>();
builder.Services.AddSingleton<WorkspaceCredentialValidator>();
builder.Services.AddSingleton<JwtTokenService>();

var authOptions = builder.Configuration.GetSection(AuthOptions.SectionName).Get<AuthOptions>()
    ?? new AuthOptions();
var signingKey = authOptions.JwtSigningKey?.Trim() ?? "";
if (signingKey.Length < 32)
{
    // Allow the host to start for health checks; login returns 503 until secrets are set.
    signingKey = "dev-only-placeholder-signing-key!!";
}

builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateIssuerSigningKey = true,
            ValidateLifetime = true,
            ClockSkew = TimeSpan.FromMinutes(1),
            ValidIssuer = string.IsNullOrWhiteSpace(authOptions.JwtIssuer)
                ? "AiBusiness.Api"
                : authOptions.JwtIssuer,
            ValidAudience = string.IsNullOrWhiteSpace(authOptions.JwtAudience)
                ? "AiBusiness.Frontend"
                : authOptions.JwtAudience,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(signingKey)),
        };
    });

builder.Services.AddAuthorization(options =>
{
    options.FallbackPolicy = new AuthorizationPolicyBuilder()
        .RequireAuthenticatedUser()
        .Build();
});

var rateLimit = builder.Configuration
    .GetSection(AssistantRateLimitOptions.SectionName)
    .Get<AssistantRateLimitOptions>() ?? new AssistantRateLimitOptions();
var permitLimit = rateLimit.PermitLimit <= 0 ? 20 : rateLimit.PermitLimit;
var windowSeconds = rateLimit.WindowSeconds <= 0 ? 60 : rateLimit.WindowSeconds;

builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.OnRejected = async (context, cancellationToken) =>
    {
        context.HttpContext.Response.ContentType = "application/problem+json";
        if (context.Lease.TryGetMetadata(MetadataName.RetryAfter, out var retryAfter))
        {
            context.HttpContext.Response.Headers.RetryAfter = ((int)retryAfter.TotalSeconds).ToString();
        }

        await context.HttpContext.Response.WriteAsJsonAsync(
            new
            {
                title = "Too many AI requests",
                detail = "You have reached the AI request limit. Wait a minute and try again.",
                status = StatusCodes.Status429TooManyRequests,
            },
            cancellationToken);
    };

    options.AddPolicy("assistant", httpContext =>
    {
        var partitionKey = httpContext.User.Identity?.Name
            ?? httpContext.Connection.RemoteIpAddress?.ToString()
            ?? "anonymous";

        return RateLimitPartition.GetFixedWindowLimiter(
            partitionKey,
            _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = permitLimit,
                Window = TimeSpan.FromSeconds(windowSeconds),
                QueueLimit = 0,
                AutoReplenishment = true,
            });
    });
});

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi().AllowAnonymous();
}

app.UseAuthentication();
app.UseAuthorization();
app.UseRateLimiter();

if (app.Configuration.GetValue<bool>("ApplyMigrationsOnStartup"))
{
    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    db.Database.Migrate();
}

app.MapControllers();

app.Run();

static string NormalizePostgresConnectionString(string connectionString)
{
    if (string.IsNullOrWhiteSpace(connectionString))
    {
        return connectionString;
    }

    var trimmed = connectionString.Trim();
    if (!trimmed.StartsWith("postgres://", StringComparison.OrdinalIgnoreCase) &&
        !trimmed.StartsWith("postgresql://", StringComparison.OrdinalIgnoreCase))
    {
        return trimmed;
    }

    var uri = new Uri(trimmed);
    var userInfo = uri.UserInfo.Split(':', 2);
    var username = Uri.UnescapeDataString(userInfo[0]);
    var password = userInfo.Length > 1 ? Uri.UnescapeDataString(userInfo[1]) : "";
    var port = uri.Port > 0 ? uri.Port : 5432;
    var database = uri.AbsolutePath.TrimStart('/');

    var builder = new Npgsql.NpgsqlConnectionStringBuilder
    {
        Host = uri.Host,
        Port = port,
        Database = database,
        Username = username,
        Password = password,
        SslMode = Npgsql.SslMode.Prefer,
    };

    if (!string.IsNullOrEmpty(uri.Query))
    {
        var queryParams = uri.Query.TrimStart('?').Split('&');
        foreach (var param in queryParams)
        {
            var parts = param.Split('=', 2);
            if (parts.Length == 2 && parts[0].Equals("sslmode", StringComparison.OrdinalIgnoreCase))
            {
                if (Enum.TryParse<Npgsql.SslMode>(parts[1], true, out var sslMode))
                {
                    builder.SslMode = sslMode;
                }
            }
        }
    }

    return builder.ConnectionString;
}

public partial class Program;
