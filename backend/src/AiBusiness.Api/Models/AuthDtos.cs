namespace AiBusiness.Api.Models;

public sealed class LoginRequest
{
    public string Username { get; set; } = "";
    public string Password { get; set; } = "";
}

public sealed class LoginResponse
{
    public string AccessToken { get; init; } = "";
    public DateTimeOffset ExpiresAt { get; init; }
    public string DisplayName { get; init; } = "";
}
