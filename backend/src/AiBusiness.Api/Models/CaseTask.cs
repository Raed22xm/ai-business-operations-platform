using System.Text.Json.Serialization;

namespace AiBusiness.Api.Models;

public class CaseTask
{
    public int Id { get; set; }
    public int CaseId { get; set; }
    [JsonIgnore]
    public Case? Case { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public DateOnly? DueDate { get; set; }
    [JsonConverter(typeof(JsonStringEnumConverter))]
    public CaseTaskStatus Status { get; set; } = CaseTaskStatus.Todo;
    public DateTime CreatedAt { get; set; }
}
