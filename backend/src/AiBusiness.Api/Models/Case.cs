using System.Text.Json.Serialization;

namespace AiBusiness.Api.Models;

public class Case
{
    public int Id { get; set; }
    public int CustomerId { get; set; }
    [JsonIgnore]
    public Customer? Customer { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    [JsonConverter(typeof(JsonStringEnumConverter))]
    public CaseStatus Status { get; set; } = CaseStatus.Open;
    public DateTime CreatedAt { get; set; }

    /// <summary>
    /// UTC time when the case was archived. Null means the case is active (operational).
    /// </summary>
    public DateTime? ArchivedAt { get; set; }
}
