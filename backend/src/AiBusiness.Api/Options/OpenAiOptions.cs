namespace AiBusiness.Api.Options;

public sealed class OpenAiOptions
{
    public const string SectionName = "OpenAI";

    /// <summary>API key from user-secrets or OpenAI__ApiKey. Never commit this value.</summary>
    public string? ApiKey { get; set; }

    /// <summary>Chat model id, for example gpt-4o-mini.</summary>
    public string Model { get; set; } = "gpt-4o-mini";

    /// <summary>Base URL for the OpenAI-compatible chat completions API.</summary>
    public string BaseUrl { get; set; } = "https://api.openai.com/v1";

    /// <summary>HTTP timeout for provider calls.</summary>
    public int TimeoutSeconds { get; set; } = 30;
}
