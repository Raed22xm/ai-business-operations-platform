using AiBusiness.Api.Data;
using AiBusiness.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace AiBusiness.Api.Services;

public sealed class CaseEscalationResult
{
    public enum StatusKind { Success, NotFound, Archived }

    public StatusKind Status { get; private init; }
    public CaseEscalationResponse? Data { get; private init; }

    public static CaseEscalationResult Success(CaseEscalationResponse data) =>
        new() { Status = StatusKind.Success, Data = data };

    public static CaseEscalationResult NotFound() =>
        new() { Status = StatusKind.NotFound };

    public static CaseEscalationResult Archived() =>
        new() { Status = StatusKind.Archived };
}

public sealed class CaseEscalationService
{
    private readonly AppDbContext _database;
    private readonly IBusinessClock _clock;

    public CaseEscalationService(AppDbContext database, IBusinessClock clock)
    {
        _database = database;
        _clock = clock;
    }

    public async Task<CaseEscalationResult> CheckAsync(
        int caseId,
        CancellationToken cancellationToken = default)
    {
        var work = await _database.Cases
            .AsNoTracking()
            .FirstOrDefaultAsync(c => c.Id == caseId, cancellationToken);

        if (work is null)
        {
            return CaseEscalationResult.NotFound();
        }

        if (CaseArchiveRules.IsArchived(work.ArchivedAt))
        {
            return CaseEscalationResult.Archived();
        }

        var tasks = await _database.CaseTasks
            .AsNoTracking()
            .Where(t => t.CaseId == caseId)
            .OrderBy(t => t.DueDate)
            .ThenBy(t => t.Id)
            .ToListAsync(cancellationToken);

        var today = _clock.Today;
        var flags = new List<EscalationFlag>();

        // Rule 1: Overdue unfinished tasks
        foreach (var task in tasks)
        {
            if (task.Status != CaseTaskStatus.Done && TaskDueDateRules.IsOverdue(task.DueDate, task.Status, today))
            {
                var dueStr = task.DueDate.HasValue ? task.DueDate.Value.ToString("yyyy-MM-dd") : "unknown";
                flags.Add(new EscalationFlag
                {
                    Rule = "OverdueTask",
                    Reason = $"Task “{task.Title}” is overdue (due {dueStr}).",
                    TaskId = task.Id,
                    TaskTitle = task.Title,
                    Severity = "NeedsReview",
                });
            }
        }

        // Rule 2: High-priority unfinished tasks
        foreach (var task in tasks)
        {
            if (task.Status != CaseTaskStatus.Done && task.Priority == CaseTaskPriority.High)
            {
                flags.Add(new EscalationFlag
                {
                    Rule = "HighPriorityTask",
                    Reason = $"High-priority task “{task.Title}” is unfinished ({FormatTaskStatus(task.Status)}).",
                    TaskId = task.Id,
                    TaskTitle = task.Title,
                    Severity = "NeedsReview",
                });
            }
        }

        // Rule 3: Open/In-progress cases with no unfinished tasks
        if (work.Status is CaseStatus.Open or CaseStatus.InProgress)
        {
            var unfinishedCount = tasks.Count(t => t.Status != CaseTaskStatus.Done);
            if (unfinishedCount == 0)
            {
                var statusText = work.Status == CaseStatus.Open ? "Open" : "In progress";
                flags.Add(new EscalationFlag
                {
                    Rule = "NoUnfinishedTasks",
                    Reason = $"Case is {statusText} with no unfinished tasks to make progress.",
                    TaskId = null,
                    TaskTitle = null,
                    Severity = "NeedsReview",
                });
            }
        }

        var response = new CaseEscalationResponse
        {
            CaseId = work.Id,
            CaseTitle = work.Title,
            CaseStatus = work.Status.ToString(),
            NeedsReview = flags.Count > 0,
            SummaryMessage = flags.Count > 0
                ? $"{flags.Count} {(flags.Count == 1 ? "item needs review" : "items need review")}."
                : "No attention flags found.",
            Flags = flags,
        };

        return CaseEscalationResult.Success(response);
    }

    private static string FormatTaskStatus(CaseTaskStatus status) => status switch
    {
        CaseTaskStatus.Todo => "To do",
        CaseTaskStatus.InProgress => "In progress",
        CaseTaskStatus.Done => "Done",
        _ => status.ToString(),
    };
}
