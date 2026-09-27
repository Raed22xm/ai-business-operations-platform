using System.Text.Json.Serialization;

namespace AiBusiness.Api.Models;

public enum ResponseDraftStatus
{
    Draft,
    Approved,
}

public enum ResponseDraftSource
{
    Ai,
    Mock,
    Manual,
}

public class ResponseDraft
{
    public const int MaxContentLength = 10000;

    public int Id { get; set; }

    public int CaseId { get; set; }

    [JsonIgnore]
    public Case? Case { get; set; }

    public string Content { get; set; } = string.Empty;

    [JsonConverter(typeof(JsonStringEnumConverter))]
    public ResponseDraftSource Source { get; set; } = ResponseDraftSource.Ai;

    [JsonConverter(typeof(JsonStringEnumConverter))]
    public ResponseDraftStatus Status { get; set; } = ResponseDraftStatus.Draft;

    public string CreatedBy { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; }

    public DateTime? UpdatedAt { get; set; }

    public string? ApprovedBy { get; set; }

    public DateTime? ApprovedAt { get; set; }

    /// <summary>
    /// Concurrency token incremented on each update to detect conflicting updates.
    /// </summary>
    public int Version { get; set; } = 1;
}
