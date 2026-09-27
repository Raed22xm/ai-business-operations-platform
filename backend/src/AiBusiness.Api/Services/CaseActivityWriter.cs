using AiBusiness.Api.Data;
using AiBusiness.Api.Models;

namespace AiBusiness.Api.Services;

/// <summary>
/// Appends product activity rows to the current DbContext change set.
/// Callers must save in the same transaction as the business change.
/// </summary>
public sealed class CaseActivityWriter
{
    private const int MaximumDescriptionLength = 200;
    private readonly AppDbContext _database;

    public CaseActivityWriter(AppDbContext database)
    {
        _database = database;
    }

    public void Record(
        int caseId,
        CaseActivityEventType eventType,
        string description,
        string? actorName)
    {
        if (caseId <= 0)
        {
            throw new ArgumentOutOfRangeException(nameof(caseId));
        }

        var text = NormalizeDescription(description);
        _database.CaseActivities.Add(new CaseActivity
        {
            CaseId = caseId,
            EventType = eventType,
            Description = text,
            OccurredAt = UtcNow(),
            ActorName = NormalizeActor(actorName),
        });
    }

    private static string NormalizeDescription(string description)
    {
        var trimmed = description.Trim();
        if (trimmed.Length == 0)
        {
            throw new ArgumentException("Description is required.", nameof(description));
        }

        return trimmed.Length <= MaximumDescriptionLength
            ? trimmed
            : trimmed[..MaximumDescriptionLength];
    }

    private static string? NormalizeActor(string? actorName)
    {
        var trimmed = actorName?.Trim();
        return string.IsNullOrEmpty(trimmed) ? null : trimmed;
    }

    private static DateTime UtcNow()
    {
        var now = DateTime.UtcNow;
        var ticks = now.Ticks - (now.Ticks % TimeSpan.TicksPerMicrosecond);
        return new DateTime(ticks, DateTimeKind.Utc);
    }
}
