namespace AiBusiness.Api.Options;

public sealed class CsvExportOptions
{
    public const string SectionName = "CsvExport";

    /// <summary>
    /// Maximum rows returned by a single export (headers excluded).
    /// Narrow filters when the matching set is larger.
    /// </summary>
    public int MaxRows { get; set; } = 10_000;
}
