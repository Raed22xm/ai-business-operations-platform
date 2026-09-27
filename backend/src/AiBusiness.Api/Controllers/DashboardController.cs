using AiBusiness.Api.Data;
using AiBusiness.Api.Models;
using AiBusiness.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AiBusiness.Api.Controllers;

[ApiController]
[Route("api/dashboard")]
public class DashboardController : ControllerBase
{
    public const int OutstandingListLimit = 8;

    private readonly AppDbContext _database;
    private readonly IBusinessClock _clock;

    public DashboardController(AppDbContext database, IBusinessClock clock)
    {
        _database = database;
        _clock = clock;
    }

    [HttpGet("summary")]
    [EndpointSummary("Dashboard summary")]
    [EndpointDescription(
        "Returns count totals calculated in the database: customers, cases by status, "
            + "overdue tasks, tasks due today, and a compact outstanding-task list. "
            + "Due dates are calendar dates; overdue uses BusinessTimezone (default Europe/Copenhagen). "
            + "Empty tables return zeros.")]
    [ProducesResponseType(typeof(DashboardSummary), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetSummary()
    {
        var today = _clock.Today;

        var totalCustomers = await _database.Customers.CountAsync();
        var totalCases = await _database.Cases.CountAsync(work => work.ArchivedAt == null);
        var openCases = await _database.Cases.CountAsync(work =>
            work.ArchivedAt == null && work.Status == CaseStatus.Open);
        var inProgressCases = await _database.Cases.CountAsync(work =>
            work.ArchivedAt == null && work.Status == CaseStatus.InProgress);
        var closedCases = await _database.Cases.CountAsync(work =>
            work.ArchivedAt == null && work.Status == CaseStatus.Closed);

        var overdueTasks = await _database.CaseTasks.CountAsync(task =>
            task.Case != null
            && task.Case.ArchivedAt == null
            && task.DueDate != null
            && task.DueDate < today
            && task.Status != CaseTaskStatus.Done);

        var dueTodayTasks = await _database.CaseTasks.CountAsync(task =>
            task.Case != null
            && task.Case.ArchivedAt == null
            && task.DueDate != null
            && task.DueDate == today
            && task.Status != CaseTaskStatus.Done);

        var outstandingRows = await _database.CaseTasks
            .AsNoTracking()
            .Where(task =>
                task.Status != CaseTaskStatus.Done
                && task.Case != null
                && task.Case.ArchivedAt == null)
            .OrderBy(task => task.DueDate ?? DateOnly.MaxValue)
            .ThenBy(task => task.Id)
            .Take(OutstandingListLimit)
            .Select(task => new
            {
                task.Id,
                task.CaseId,
                CaseTitle = task.Case != null ? task.Case.Title : "",
                task.Title,
                task.DueDate,
                task.Status,
                task.Priority,
            })
            .ToListAsync();

        var outstanding = outstandingRows
            .Select(task => new OutstandingTaskItem
            {
                Id = task.Id,
                CaseId = task.CaseId,
                CaseTitle = task.CaseTitle,
                Title = task.Title,
                DueDate = task.DueDate,
                Status = task.Status,
                Priority = task.Priority,
                IsOverdue = TaskDueDateRules.IsOverdue(task.DueDate, task.Status, today),
                IsDueToday = TaskDueDateRules.IsDueToday(task.DueDate, task.Status, today),
            })
            .ToArray();

        return Ok(new DashboardSummary
        {
            TotalCustomers = totalCustomers,
            TotalCases = totalCases,
            OpenCases = openCases,
            InProgressCases = inProgressCases,
            ClosedCases = closedCases,
            OverdueTasks = overdueTasks,
            DueTodayTasks = dueTodayTasks,
            OutstandingTasks = outstanding,
            BusinessTimeZone = _clock.TimeZoneId,
            BusinessToday = today.ToString("yyyy-MM-dd"),
        });
    }
}
