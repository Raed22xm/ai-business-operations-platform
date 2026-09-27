using Npgsql;

namespace AiBusiness.Api.Tests.Integration;

/// <summary>
/// Rejects the known local development database so integration tests never
/// reset, migrate, or truncate developer data.
/// </summary>
public static class DevelopmentConnectionGuard
{
    public const string ForbiddenDatabaseName = "aibusiness_customers_dev";

    public static void EnsureNotDevelopmentDatabase(string connectionString)
    {
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            throw new InvalidOperationException("Integration tests require a connection string.");
        }

        var builder = new NpgsqlConnectionStringBuilder(connectionString);
        var database = builder.Database?.Trim() ?? string.Empty;

        if (string.Equals(database, ForbiddenDatabaseName, StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException(
                $"Refusing to use the development database '{ForbiddenDatabaseName}'. "
                + "Integration tests must use a disposable PostgreSQL database.");
        }

        if (database.Length == 0)
        {
            throw new InvalidOperationException(
                "Integration tests require an explicit database name in the connection string.");
        }
    }
}
