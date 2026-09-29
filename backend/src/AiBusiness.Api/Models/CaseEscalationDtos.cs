namespace AiBusiness.Api.Models;

public sealed class CaseEscalationResponse
{
    public required int CaseId { get; init; }
    public required string CaseTitle { get; init; }
    public required string CaseStatus { get; init; }
    public required bool NeedsReview { get; init; }
    public required string SummaryMessage { get; init; }
    public required IReadOnlyList<EscalationFlag> Flags { get; init; }
}

public sealed class EscalationFlag
{
    public required string Rule { get; init; }
    public required string Reason { get; init; }
    public int? TaskId { get; init; }
    public string? TaskTitle { get; init; }
    public string Severity { get; init; } = "NeedsReview";
}
