namespace AiBusiness.Api.Options;

public sealed class AssistantRateLimitOptions
{
    public const string SectionName = "RateLimiting:Assistant";

    public int PermitLimit { get; set; } = 20;

    public int WindowSeconds { get; set; } = 60;
}
