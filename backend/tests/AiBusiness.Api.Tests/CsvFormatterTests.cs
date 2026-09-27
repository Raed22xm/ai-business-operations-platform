using System.Text;
using AiBusiness.Api.Services;

namespace AiBusiness.Api.Tests;

public class CsvFormatterTests
{
    [Fact]
    public void Build_EmptyRows_ReturnsHeadersOnlyWithCrlf()
    {
        var csv = CsvFormatter.Build(["A", "B"], Array.Empty<IReadOnlyList<string?>>());
        Assert.Equal("A,B\r\n", csv);
    }

    [Fact]
    public void EscapeField_QuotesCommasQuotesAndNewlines()
    {
        Assert.Equal("plain", CsvFormatter.EscapeField("plain"));
        Assert.Equal("\"a,b\"", CsvFormatter.EscapeField("a,b"));
        Assert.Equal("\"say \"\"hi\"\"\"", CsvFormatter.EscapeField("say \"hi\""));
        Assert.Equal("\"line1\r\nline2\"", CsvFormatter.EscapeField("line1\r\nline2"));
    }

    [Fact]
    public void SanitizeCell_NeutralizesFormulaPrefixes()
    {
        Assert.Equal("'=1+1", CsvFormatter.SanitizeCell("=1+1"));
        Assert.Equal("'+cmd", CsvFormatter.SanitizeCell("+cmd"));
        Assert.Equal("'-1", CsvFormatter.SanitizeCell("-1"));
        Assert.Equal("'@SUM(A1)", CsvFormatter.SanitizeCell("@SUM(A1)"));
        Assert.Equal("'\tTAB", CsvFormatter.SanitizeCell("\tTAB"));
        Assert.Equal("'\rCR", CsvFormatter.SanitizeCell("\rCR"));
        Assert.Equal("", CsvFormatter.SanitizeCell(null));
        Assert.Equal("", CsvFormatter.SanitizeCell(""));
        Assert.Equal("safe", CsvFormatter.SanitizeCell("safe"));
    }

    [Fact]
    public void Build_HandlesUnicodeAndEmptyValues()
    {
        var csv = CsvFormatter.Build(
            ["Name", "Note"],
            [new string?[] { "Café 日本語", null }, new string?[] { "", "ok" }]);
        Assert.Equal("Name,Note\r\nCafé 日本語,\r\n,ok\r\n", csv);
    }

    [Fact]
    public void FormatUtcTimestamp_LabelsUtc()
    {
        var value = new DateTime(2026, 9, 27, 14, 30, 5, DateTimeKind.Utc);
        Assert.Equal("2026-09-27 14:30:05 UTC", CsvFormatter.FormatUtcTimestamp(value));
    }

    [Fact]
    public void TimestampedFileName_UsesUtcStamp()
    {
        var name = CsvFormatter.TimestampedFileName(
            "customers",
            new DateTimeOffset(2026, 9, 27, 14, 30, 5, TimeSpan.Zero));
        Assert.Equal("customers-20260927T143005Z.csv", name);
    }

    [Fact]
    public void Build_PreservesColumnOrder_AndAppliesFormulaGuardOnExportCells()
    {
        var csv = CsvFormatter.Build(
            ["Id", "Name"],
            [new string?[] { "1", "=HYPERLINK(\"http://evil\")" }]);
        Assert.Equal("Id,Name\r\n1,\"'=HYPERLINK(\"\"http://evil\"\")\"\r\n", csv);
    }
}
