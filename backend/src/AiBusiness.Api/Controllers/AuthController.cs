using AiBusiness.Api.Models;
using AiBusiness.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AiBusiness.Api.Controllers;

[ApiController]
[Route("api/auth")]
public sealed class AuthController : ControllerBase
{
    private readonly WorkspaceCredentialValidator _credentials;
    private readonly JwtTokenService _tokens;

    public AuthController(WorkspaceCredentialValidator credentials, JwtTokenService tokens)
    {
        _credentials = credentials;
        _tokens = tokens;
    }

    [AllowAnonymous]
    [HttpPost("login")]
    [ProducesResponseType(typeof(LoginResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status503ServiceUnavailable)]
    public IActionResult Login([FromBody] LoginRequest? request)
    {
        if (!_credentials.IsConfigured)
        {
            return Problem(
                detail: "Sign-in is not configured on the server. Set Auth:Username, Auth:Password, and Auth:JwtSigningKey.",
                statusCode: StatusCodes.Status503ServiceUnavailable,
                title: "Auth not configured");
        }

        var username = request?.Username?.Trim() ?? "";
        var password = request?.Password ?? "";
        if (username.Length == 0 || password.Length == 0)
        {
            return Unauthorized(new { detail = "Invalid username or password." });
        }

        if (!_credentials.Validate(username, password))
        {
            return Unauthorized(new { detail = "Invalid username or password." });
        }

        var (token, expiresAt) = _tokens.CreateToken(username);
        return Ok(new LoginResponse
        {
            AccessToken = token,
            ExpiresAt = expiresAt,
            DisplayName = username,
        });
    }

    [Authorize]
    [HttpGet("me")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public IActionResult Me()
    {
        return Ok(new
        {
            displayName = User.Identity?.Name ?? "Workspace",
        });
    }

    [AllowAnonymous]
    [HttpPost("logout")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public IActionResult Logout()
    {
        // JWT is stateless; clients clear their session cookie.
        return NoContent();
    }
}
