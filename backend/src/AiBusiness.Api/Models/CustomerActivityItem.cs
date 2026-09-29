using System.Text.Json.Serialization;

namespace AiBusiness.Api.Models;

public class CustomerActivityItem
{
    public long Id { get; set; }
    public int CaseId { get; set; }
    public string CaseTitle { get; set; } = string.Empty;

    [JsonConverter(typeof(JsonStringEnumConverter))]
    public CaseActivityEventType EventType { get; set; }

    public string Description { get; set; } = string.Empty;
    public DateTime OccurredAt { get; set; }
    public string? ActorName { get; set; }
}
