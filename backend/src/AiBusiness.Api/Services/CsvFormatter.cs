using System.Globalization;
using System.Text;

namespace AiBusiness.Api.Services;

/// <summary>
/// Builds RFC-style CSV text safely for spreadsheet consumers.
/// Does not write permanent files; callers stream the result.
/// </summary>
public static class CsvFormatter
{
    private static readonly char[] FormulaPrefixes = ['=', '+', '-', '@', '\t', '\r'];

    public static string Build(IReadOnlyList<string> headers, IEnumerable<IReadOnlyList<string?>> rows)
    {
        ArgumentNullException.ThrowIfNull(headers);
        ArgumentNullException.ThrowIfNull(rows);

        var builder = new StringBuilder();
        WriteRow(builder, headers);
        foreach (var row in rows)
        {
            if (row.Count != headers.Count)
            {
                throw new ArgumentException(
                    $"Row has {row.Count} fields but {headers.Count} headers were provided.",
                    nameof(rows));
            }

            WriteRow(builder, row);
        }

        return builder.ToString();
    }

    public static string FormatUtcTimestamp(DateTime value)
    {
        var utc = value.Kind == DateTimeKind.Unspecified
            ? DateTime.SpecifyKind(value, DateTimeKind.Utc)
            : value.ToUniversalTime();
        return utc.ToString("yyyy-MM-dd HH:mm:ss", CultureInfo.InvariantCulture) + " UTC";
    }

    public static string SanitizeCell(string? value)
    {
        if (string.IsNullOrEmpty(value))
        {
            return "";
        }

        var text = value;
        // Neutralize spreadsheet formula injection for user-entered fields.
        if (FormulaPrefixes.Contains(text[0]))
        {
            text = "'" + text;
        }

        return text;
    }

    public static string EscapeField(string? value)
    {
        var text = SanitizeCell(value);
        var needsQuotes =
            text.Contains(',')
            || text.Contains('"')
            || text.Contains('\r')
            || text.Contains('\n');

        if (!needsQuotes)
        {
            return text;
        }

        return "\"" + text.Replace("\"", "\"\"", StringComparison.Ordinal) + "\"";
    }

    public static string TimestampedFileName(string prefix, DateTimeOffset utcNow)
    {
        var stamp = utcNow.UtcDateTime.ToString("yyyyMMdd'T'HHmmss'Z'", CultureInfo.InvariantCulture);
        return $"{prefix}-{stamp}.csv";
    }

    private static void WriteRow(StringBuilder builder, IReadOnlyList<string?> fields)
    {
        for (var i = 0; i < fields.Count; i++)
        {
            if (i > 0)
            {
                builder.Append(',');
            }

            builder.Append(EscapeField(fields[i]));
        }

        builder.Append("\r\n");
    }
}
