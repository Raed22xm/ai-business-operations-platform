using AiBusiness.Api.Options;
using AiBusiness.Api.Services;

namespace AiBusiness.Api.Tests;

internal static class TestCsvExport
{
    public static CsvExportService Service(int maxRows = 10_000) =>
        new(Microsoft.Extensions.Options.Options.Create(new CsvExportOptions { MaxRows = maxRows }));
}
