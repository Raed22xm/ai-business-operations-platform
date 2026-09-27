using System.Security.Cryptography;
using System.Text;
using AiBusiness.Api.Options;
using Microsoft.Extensions.Options;

namespace AiBusiness.Api.Services;

public sealed class WorkspaceCredentialValidator
{
    private readonly AuthOptions _options;

    public WorkspaceCredentialValidator(IOptions<AuthOptions> options)
    {
        _options = options.Value;
    }

    public bool IsConfigured =>
        !string.IsNullOrWhiteSpace(_options.Username)
        && !string.IsNullOrWhiteSpace(_options.Password)
        && !string.IsNullOrWhiteSpace(_options.JwtSigningKey)
        && _options.JwtSigningKey.Trim().Length >= 32;

    public bool Validate(string username, string password)
    {
        if (!IsConfigured)
        {
            return false;
        }

        var expectedUser = Encoding.UTF8.GetBytes(_options.Username.Trim());
        var actualUser = Encoding.UTF8.GetBytes((username ?? "").Trim());
        var expectedPass = Encoding.UTF8.GetBytes(_options.Password);
        var actualPass = Encoding.UTF8.GetBytes(password ?? "");

        var userOk = expectedUser.Length == actualUser.Length
            && CryptographicOperations.FixedTimeEquals(expectedUser, actualUser);
        var passOk = expectedPass.Length == actualPass.Length
            && CryptographicOperations.FixedTimeEquals(expectedPass, actualPass);

        return userOk && passOk;
    }
}
