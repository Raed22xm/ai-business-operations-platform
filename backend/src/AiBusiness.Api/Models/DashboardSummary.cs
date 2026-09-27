namespace AiBusiness.Api.Models;

public class DashboardSummary
{
    public int TotalCustomers { get; set; }
    public int TotalCases { get; set; }
    public int OpenCases { get; set; }
    public int InProgressCases { get; set; }
    public int ClosedCases { get; set; }

    /// <summary>Tasks with due date before today (business TZ) and status not Done.</summary>
    public int OverdueTasks { get; set; }

    /// <summary>Tasks due today (business TZ) and status not Done.</summary>
    public int DueTodayTasks { get; set; }

    /// <summary>
    /// Compact list of outstanding (not Done) tasks, earliest due date first.
    /// Null due dates sort last. Counts above cover all matching rows, not only this list.
    /// </summary>
    public OutstandingTaskItem[] OutstandingTasks { get; set; } = [];

    /// <summary>IANA time zone used for overdue / due-today calculations.</summary>
    public string BusinessTimeZone { get; set; } = "Europe/Copenhagen";

    /// <summary>Calendar today in the business time zone (YYYY-MM-DD).</summary>
    public string BusinessToday { get; set; } = string.Empty;
}
