namespace AiBusiness.Api.Tests.Integration;

public class DevelopmentConnectionGuardTests
{
    [Fact]
    public void EnsureNotDevelopmentDatabase_RejectsKnownDevDatabaseName()
    {
        var connection =
            "Host=127.0.0.1;Port=5434;Database=aibusiness_customers_dev;Username=test;Password=test";

        var error = Assert.Throws<InvalidOperationException>(
            () => DevelopmentConnectionGuard.EnsureNotDevelopmentDatabase(connection));

        Assert.Contains(
            DevelopmentConnectionGuard.ForbiddenDatabaseName,
            error.Message,
            StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void EnsureNotDevelopmentDatabase_AllowsDisposableDatabaseName()
    {
        var connection =
            "Host=127.0.0.1;Port=55432;Database=aibusiness_integration_tests;Username=test;Password=test";

        DevelopmentConnectionGuard.EnsureNotDevelopmentDatabase(connection);
    }
}
