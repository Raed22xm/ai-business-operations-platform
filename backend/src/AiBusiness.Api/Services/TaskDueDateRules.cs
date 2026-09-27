using AiBusiness.Api.Models;

namespace AiBusiness.Api.Services;

/// <summary>
/// Due-date rules for tasks. Due dates are calendar dates (no time-of-day).
/// A task is overdue when DueDate is before today (business timezone) and Status is not Done.
/// Tasks due today are not overdue. Tasks with no due date are never overdue.
/// </summary>
public static class TaskDueDateRules
{
    public static bool IsOverdue(DateOnly? dueDate, CaseTaskStatus status, DateOnly today)
    {
        if (dueDate is null || status == CaseTaskStatus.Done)
        {
            return false;
        }

        return dueDate.Value < today;
    }

    public static bool IsDueToday(DateOnly? dueDate, CaseTaskStatus status, DateOnly today)
    {
        if (dueDate is null || status == CaseTaskStatus.Done)
        {
            return false;
        }

        return dueDate.Value == today;
    }

    public static bool IsOutstanding(CaseTaskStatus status) => status != CaseTaskStatus.Done;
}
