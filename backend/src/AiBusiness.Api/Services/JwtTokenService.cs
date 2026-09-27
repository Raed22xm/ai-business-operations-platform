using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using AiBusiness.Api.Options;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;

namespace AiBusiness.Api.Services;

public sealed class JwtTokenService
{
    private readonly AuthOptions _options;

    public JwtTokenService(IOptions<AuthOptions> options)
    {
        _options = options.Value;
    }

    public (string Token, DateTimeOffset ExpiresAt) CreateToken(string username)
    {
        var minutes = _options.JwtExpirationMinutes <= 0 ? 480 : _options.JwtExpirationMinutes;
        var expires = DateTimeOffset.UtcNow.AddMinutes(minutes);
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_options.JwtSigningKey.Trim()));
        var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        var displayName = string.IsNullOrWhiteSpace(username) ? "Workspace" : username.Trim();

        var token = new JwtSecurityToken(
            issuer: _options.JwtIssuer,
            audience: _options.JwtAudience,
            claims:
            [
                new Claim(JwtRegisteredClaimNames.Sub, displayName),
                new Claim(ClaimTypes.Name, displayName),
                new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString("N")),
            ],
            notBefore: DateTime.UtcNow.AddSeconds(-5),
            expires: expires.UtcDateTime,
            signingCredentials: credentials);

        return (new JwtSecurityTokenHandler().WriteToken(token), expires);
    }
}
