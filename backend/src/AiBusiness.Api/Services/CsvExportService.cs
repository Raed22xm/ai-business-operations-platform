using System.Text;
using AiBusiness.Api.Options;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;

namespace AiBusiness.Api.Services;

public sealed class CsvExportService
{
    private readonly CsvExportOptions _options;

    public CsvExportService(IOptions<CsvExportOptions> options)
    {
        _options = options.Value;
    }

    public int MaxRows
    {
        get
        {
            var max = _options.MaxRows;
            return max <= 0 ? 10_000 : max;
        }
    }

    public FileContentResult File(string fileName, string csvBody)
    {
        var bytes = Encoding.UTF8.GetPreamble().Concat(Encoding.UTF8.GetBytes(csvBody)).ToArray();
        return new FileContentResult(bytes, "text/csv; charset=utf-8")
        {
            FileDownloadName = fileName,
        };
    }

    public string FileName(string prefix) =>
        CsvFormatter.TimestampedFileName(prefix, DateTimeOffset.UtcNow);
}
