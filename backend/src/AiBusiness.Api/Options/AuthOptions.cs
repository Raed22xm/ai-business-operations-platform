namespace AiBusiness.Api.Options;

public sealed class AuthOptions
{
    public const string SectionName = "Auth";

    public string Username { get; set; } = "";

    /// <summary>Workspace password from user-secrets or Auth__Password. Never commit.</summary>
    public string Password { get; set; } = "";

    /// <summary>Symmetric signing key (at least 32 characters). From user-secrets or Auth__JwtSigningKey.</summary>
    public string JwtSigningKey { get; set; } = "";

    public string JwtIssuer { get; set; } = "AiBusiness.Api";

    public string JwtAudience { get; set; } = "AiBusiness.Frontend";

    public int JwtExpirationMinutes { get; set; } = 480;
}
