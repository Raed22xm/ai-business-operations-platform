using System.Text.Json.Serialization;

namespace AiBusiness.Api.Models;

public enum CaseActivityEventType
{
    CaseCreated,
    CaseEdited,
    CaseStatusChanged,
    CaseArchived,
    CaseRestored,
    TaskCreated,
    TaskUpdated,
    TaskCompleted,
    TaskDeleted,
}

public class CaseActivity
{
    public long Id { get; set; }
    public int CaseId { get; set; }
    [JsonIgnore]
    public Case? Case { get; set; }

    [JsonConverter(typeof(JsonStringEnumConverter))]
    public CaseActivityEventType EventType { get; set; }

    /// <summary>Short operator-facing description. No secrets, prompts, or message bodies.</summary>
    public string Description { get; set; } = string.Empty;

    public DateTime OccurredAt { get; set; }

    /// <summary>Authenticated display name when the request was authenticated; otherwise null.</summary>
    public string? ActorName { get; set; }
}
