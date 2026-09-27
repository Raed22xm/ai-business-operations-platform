namespace AiBusiness.Api.Models;

public sealed class CaseSummaryResponse
{
    public int CaseId { get; init; }
    public string RequestSummary { get; init; } = "";
    public string Status { get; init; } = "";
    public string[] OutstandingTasks { get; init; } = [];
    public string SuggestedNextAction { get; init; } = "";
    public string FormattedText { get; init; } = "";
    public string Source { get; init; } = "openai";
    public string Model { get; init; } = "";
    public string? SetupHint { get; init; }
}

public sealed class DraftResponseResponse
{
    public int CaseId { get; init; }
    public string DraftText { get; init; } = "";
    public string Source { get; init; } = "openai";
    public string Model { get; init; } = "";
    public string? SetupHint { get; init; }
}
