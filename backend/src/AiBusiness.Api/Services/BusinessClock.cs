using AiBusiness.Api.Options;
using Microsoft.Extensions.Options;

namespace AiBusiness.Api.Services;

public interface IBusinessClock
{
    /// <summary>Calendar "today" in the configured business time zone.</summary>
    DateOnly Today { get; }

    string TimeZoneId { get; }
}

public sealed class BusinessClock : IBusinessClock
{
    private readonly TimeZoneInfo _timeZone;
    private readonly Func<DateTimeOffset> _utcNow;

    public BusinessClock(IOptions<BusinessTimezoneOptions> options)
        : this(options, static () => DateTimeOffset.UtcNow)
    {
    }

    public BusinessClock(IOptions<BusinessTimezoneOptions> options, Func<DateTimeOffset> utcNow)
    {
        ArgumentNullException.ThrowIfNull(options);
        ArgumentNullException.ThrowIfNull(utcNow);

        var id = string.IsNullOrWhiteSpace(options.Value.TimeZoneId)
            ? "Europe/Copenhagen"
            : options.Value.TimeZoneId.Trim();

        _timeZone = TimeZoneInfo.FindSystemTimeZoneById(id);
        _utcNow = utcNow;
        TimeZoneId = _timeZone.Id;
    }

    public string TimeZoneId { get; }

    public DateOnly Today
    {
        get
        {
            var local = TimeZoneInfo.ConvertTime(_utcNow(), _timeZone);
            return DateOnly.FromDateTime(local.DateTime);
        }
    }
}
