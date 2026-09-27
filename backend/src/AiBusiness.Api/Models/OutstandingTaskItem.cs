using System.Text.Json.Serialization;

namespace AiBusiness.Api.Models;

public class OutstandingTaskItem
{
    public int Id { get; set; }
    public int CaseId { get; set; }
    public string CaseTitle { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public DateOnly? DueDate { get; set; }
    [JsonConverter(typeof(JsonStringEnumConverter))]
    public CaseTaskStatus Status { get; set; }
    [JsonConverter(typeof(JsonStringEnumConverter))]
    public CaseTaskPriority Priority { get; set; }
    public bool IsOverdue { get; set; }
    public bool IsDueToday { get; set; }
}
