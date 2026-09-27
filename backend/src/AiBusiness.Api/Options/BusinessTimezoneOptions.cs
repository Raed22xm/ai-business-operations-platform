namespace AiBusiness.Api.Options;

public sealed class BusinessTimezoneOptions
{
    public const string SectionName = "BusinessTimezone";

    /// <summary>
    /// IANA time zone used to decide "today" for task due dates (calendar dates).
    /// Default: Europe/Copenhagen.
    /// </summary>
    public string TimeZoneId { get; set; } = "Europe/Copenhagen";
}
