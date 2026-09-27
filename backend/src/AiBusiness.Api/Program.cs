using AiBusiness.Api;
using AiBusiness.Api.Data;
using AiBusiness.Api.Options;
using AiBusiness.Api.Services;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");
if (string.IsNullOrWhiteSpace(connectionString))
{
    throw new InvalidOperationException(
        "Missing connection string 'DefaultConnection'. Set it with dotnet user-secrets or the ConnectionStrings__DefaultConnection environment variable.");
}

builder.Services.AddControllers();
builder.Services.AddOpenApi(options => options.AddCrmDocumentation());
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(connectionString));

builder.Services.Configure<OpenAiOptions>(
    builder.Configuration.GetSection(OpenAiOptions.SectionName));

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

builder.Services.AddScoped<CaseAssistantService>();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseAuthorization();

app.MapControllers();

app.Run();

public partial class Program;
