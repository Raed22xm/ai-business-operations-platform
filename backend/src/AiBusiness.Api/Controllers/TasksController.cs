using AiBusiness.Api.Data;
using AiBusiness.Api.Models;
using AiBusiness.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AiBusiness.Api.Controllers;

[ApiController]
[Route("api/tasks")]
public class TasksController : ControllerBase
{
    private const int MaximumTitleLength = 200;
    private readonly AppDbContext _database;
    private readonly CaseActivityWriter _activity;
    private readonly IBusinessClock _clock;

    public TasksController(AppDbContext database, CaseActivityWriter activity, IBusinessClock clock)
    {
        _database = database;
        _activity = activity;
        _clock = clock;
    }

    [HttpGet]
    [EndpointSummary("List tasks")]
    [EndpointDescription(
        "Returns a JSON array of tasks ordered newest `createdAt` first, then highest `id`. "
            + "Optional filters: `caseId`, `status` (Todo|InProgress|Done, case-sensitive). Filters combine.")]
    [ProducesResponseType(typeof(CaseTask[]), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest, Description = "Invalid status.")]
    public async Task<IActionResult> GetAll(
        [FromQuery] int? caseId = null,
        [FromQuery] string? status = null)
    {
        CaseTaskStatus? statusFilter = null;
        if (!string.IsNullOrWhiteSpace(status))
        {
            if (!TryReadStatus(status.Trim(), out var parsed))
            {
                ModelState.AddModelError(nameof(status), "Status must be Todo, InProgress, or Done.");
                return ValidationProblem(ModelState);
            }

            statusFilter = parsed;
        }

        var query = _database.CaseTasks.AsQueryable();
        if (caseId is int id)
        {
            query = query.Where(task => task.CaseId == id);
        }

        if (statusFilter is CaseTaskStatus selectedStatus)
        {
            query = query.Where(task => task.Status == selectedStatus);
        }

        var items = await query
            .OrderByDescending(task => task.CreatedAt)
            .ThenByDescending(task => task.Id)
            .ToArrayAsync();

        return Ok(items);
    }

    [HttpGet("search")]
    [EndpointSummary("Search tasks across cases")]
    [EndpointDescription(
        "Returns `{ items, page, pageSize, totalCount }` of tasks across cases. "
            + "Optional filters: `search` (title or description), `customerId`, `caseId`, "
            + "`status` (Todo|InProgress|Done), `priority` (Low|Normal|High), "
            + "`due` (overdue|today|upcoming|none). "
            + "Due buckets use BusinessTimezone today; overdue/today exclude Done. "
            + "Filters apply before count and pagination. "
            + "Optional `sort`: `due` (default) earliest due first, undated last, then `id`; "
            + "`priority` High then Normal then Low, then due date, then `id`. "
            + "Defaults: page=1, pageSize=20 (max 100).")]
    [ProducesResponseType(typeof(PagedResult<TaskSearchItem>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Search(
        [FromQuery] string? search = null,
        [FromQuery] int? customerId = null,
        [FromQuery] int? caseId = null,
        [FromQuery] string? status = null,
        [FromQuery] string? priority = null,
        [FromQuery] string? due = null,
        [FromQuery] string? sort = null,
        [FromQuery] int? page = null,
        [FromQuery] int? pageSize = null)
    {
        if (!Pagination.TryResolve(
                page ?? Pagination.DefaultPage,
                pageSize ?? Pagination.DefaultPageSize,
                ModelState,
                out var resolvedPage,
                out var resolvedPageSize,
                out _))
        {
            return ValidationProblem(ModelState);
        }

        CaseTaskStatus? statusFilter = null;
        if (!string.IsNullOrWhiteSpace(status))
        {
            if (!TryReadStatus(status.Trim(), out var parsed))
            {
                ModelState.AddModelError(nameof(status), "Status must be Todo, InProgress, or Done.");
                return ValidationProblem(ModelState);
            }

            statusFilter = parsed;
        }

        CaseTaskPriority? priorityFilter = null;
        if (!string.IsNullOrWhiteSpace(priority))
        {
            if (!TryReadPriority(priority.Trim(), out var parsedPriority))
            {
                ModelState.AddModelError(nameof(priority), "Priority must be Low, Normal, or High.");
                return ValidationProblem(ModelState);
            }

            priorityFilter = parsedPriority;
        }

        string? dueFilter = null;
        if (!string.IsNullOrWhiteSpace(due))
        {
            dueFilter = due.Trim();
            if (dueFilter is not ("overdue" or "today" or "upcoming" or "none"))
            {
                ModelState.AddModelError(nameof(due), "due must be overdue, today, upcoming, or none.");
                return ValidationProblem(ModelState);
            }
        }

        var sortMode = "due";
        if (!string.IsNullOrWhiteSpace(sort))
        {
            sortMode = sort.Trim();
            if (sortMode is not ("due" or "priority"))
            {
                ModelState.AddModelError(nameof(sort), "sort must be due or priority.");
                return ValidationProblem(ModelState);
            }
        }

        var today = _clock.Today;
        var query = _database.CaseTasks.AsNoTracking().AsQueryable()
            .Where(task => task.Case == null || task.Case.ArchivedAt == null);

        if (customerId is int selectedCustomerId)
        {
            query = query.Where(task =>
                task.Case != null && task.Case.CustomerId == selectedCustomerId);
        }

        if (caseId is int selectedCaseId)
        {
            query = query.Where(task => task.CaseId == selectedCaseId);
        }

        if (statusFilter is CaseTaskStatus selectedStatus)
        {
            query = query.Where(task => task.Status == selectedStatus);
        }

        if (priorityFilter is CaseTaskPriority selectedPriority)
        {
            query = query.Where(task => task.Priority == selectedPriority);
        }

        var term = search?.Trim();
        if (!string.IsNullOrEmpty(term))
        {
            var needle = term.ToLower();
            query = query.Where(task =>
                task.Title.ToLower().Contains(needle)
                || (task.Description != null && task.Description.ToLower().Contains(needle)));
        }

        if (dueFilter is not null)
        {
            query = dueFilter switch
            {
                "overdue" => query.Where(task =>
                    task.DueDate != null
                    && task.DueDate < today
                    && task.Status != CaseTaskStatus.Done),
                "today" => query.Where(task =>
                    task.DueDate != null
                    && task.DueDate == today
                    && task.Status != CaseTaskStatus.Done),
                "upcoming" => query.Where(task =>
                    task.DueDate != null
                    && task.DueDate > today
                    && task.Status != CaseTaskStatus.Done),
                "none" => query.Where(task => task.DueDate == null),
                _ => query,
            };
        }

        IOrderedQueryable<CaseTask> ordered = sortMode == "priority"
            ? query
                .OrderBy(task =>
                    task.Priority == CaseTaskPriority.High ? 0
                    : task.Priority == CaseTaskPriority.Normal ? 1
                    : 2)
                .ThenBy(task => task.DueDate ?? DateOnly.MaxValue)
                .ThenBy(task => task.Id)
            : query
                .OrderBy(task => task.DueDate ?? DateOnly.MaxValue)
                .ThenBy(task => task.Id);

        var projected = ordered.Select(task => new TaskSearchItem
        {
            Id = task.Id,
            CaseId = task.CaseId,
            CaseTitle = task.Case != null ? task.Case.Title : "",
            CustomerId = task.Case != null ? task.Case.CustomerId : 0,
            CustomerName = task.Case != null && task.Case.Customer != null
                ? task.Case.Customer.Name
                : "",
            Title = task.Title,
            DueDate = task.DueDate,
            Status = task.Status,
            Priority = task.Priority,
        });

        var pageResult = await Pagination.ToPageAsync(projected, resolvedPage, resolvedPageSize);
        foreach (var item in pageResult.Items)
        {
            item.IsOverdue = TaskDueDateRules.IsOverdue(item.DueDate, item.Status, today);
            item.IsDueToday = TaskDueDateRules.IsDueToday(item.DueDate, item.Status, today);
        }

        return Ok(pageResult);
    }

    [HttpGet("{id:int}")]
    [EndpointSummary("Get task by id")]
    [EndpointDescription("Returns one task, or 404 if it does not exist.")]
    [ProducesResponseType(typeof(CaseTask), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetById(int id)
    {
        var task = await _database.CaseTasks.FindAsync(id);
        if (task is null)
        {
            return NotFound();
        }

        return Ok(task);
    }

    [HttpPost]
    [EndpointSummary("Create task")]
    [EndpointDescription(
        "Creates a task for an existing case. Required: `caseId`, `title` (1–200 chars). "
            + "Optional: `description`, `dueDate` (date only, YYYY-MM-DD), "
            + "`priority` (Low|Normal|High; defaults to Normal when omitted). "
            + "Server sets `id`, UTC `createdAt`, and always stores status `Todo` "
            + "(client `status`/`id`/`createdAt` ignored). Returns 201 with a Location header. "
            + "Records TaskCreated activity on the parent case in the same transaction.")]
    [ProducesResponseType(typeof(CaseTask), StatusCodes.Status201Created, Description = "Task created as Todo. Location header points at the new resource.")]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Create(CaseTask task)
    {
        await ValidateForCreate(task);
        if (!ModelState.IsValid)
        {
            return ValidationProblem(ModelState);
        }

        if (await IsCaseArchived(task.CaseId))
        {
            return ArchivedCaseConflict();
        }

        task.Id = 0;
        task.Status = CaseTaskStatus.Todo;
        _database.CaseTasks.Add(task);
        _activity.Record(
            task.CaseId,
            CaseActivityEventType.TaskCreated,
            "Task created",
            CurrentActorName());
        await _database.SaveChangesAsync();

        return CreatedAtAction(nameof(GetById), new { id = task.Id }, task);
    }

    [HttpPut("{id:int}")]
    [EndpointSummary("Update task")]
    [EndpointDescription(
        "Updates `title`, `description`, `dueDate`, `status`, and optionally `priority`. "
            + "`id`, `caseId`, and `createdAt` cannot change (body values ignored). "
            + "`status` must be exactly Todo, InProgress, or Done. "
            + "When `priority` is omitted or null, the existing priority is preserved; "
            + "when present it must be Low, Normal, or High. "
            + "Null/blank description or null dueDate clears those fields. "
            + "Successful updates record TaskUpdated, TaskCompleted, or a priority-change activity on the parent case.")]
    [ProducesResponseType(typeof(CaseTask), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Update(int id, CaseTaskUpdate changes)
    {
        var titleIsValid = TryReadTitle(changes.Title, out var title);
        var statusIsValid = TryReadStatus(changes.Status, out var status);
        if (!titleIsValid)
        {
            AddTitleError(changes.Title);
        }

        if (!statusIsValid)
        {
            ModelState.AddModelError(nameof(changes.Status), "Status must be Todo, InProgress, or Done.");
        }

        CaseTaskPriority? priorityChange = null;
        if (changes.Priority is not null)
        {
            if (!TryReadPriority(changes.Priority, out var parsedPriority))
            {
                ModelState.AddModelError(nameof(changes.Priority), "Priority must be Low, Normal, or High.");
            }
            else
            {
                priorityChange = parsedPriority;
            }
        }

        if (!ModelState.IsValid)
        {
            return ValidationProblem(ModelState);
        }

        var existing = await _database.CaseTasks.FindAsync(id);
        if (existing is null)
        {
            return NotFound();
        }

        if (await IsCaseArchived(existing.CaseId))
        {
            return ArchivedCaseConflict();
        }

        var description = NormalizeDescription(changes.Description);
        var nextPriority = priorityChange ?? existing.Priority;
        var becameDone = existing.Status != CaseTaskStatus.Done && status == CaseTaskStatus.Done;
        var priorityChanged = existing.Priority != nextPriority;
        var changed =
            !string.Equals(existing.Title, title, StringComparison.Ordinal)
            || !string.Equals(existing.Description, description, StringComparison.Ordinal)
            || existing.DueDate != changes.DueDate
            || existing.Status != status
            || priorityChanged;

        existing.Title = title;
        existing.Description = description;
        existing.DueDate = changes.DueDate;
        existing.Status = status;
        existing.Priority = nextPriority;

        if (changed)
        {
            if (becameDone)
            {
                _activity.Record(
                    existing.CaseId,
                    CaseActivityEventType.TaskCompleted,
                    "Task marked Done",
                    CurrentActorName());
            }
            else if (priorityChanged)
            {
                _activity.Record(
                    existing.CaseId,
                    CaseActivityEventType.TaskUpdated,
                    $"Task priority changed to {PriorityLabel(nextPriority)}",
                    CurrentActorName());
            }
            else
            {
                _activity.Record(
                    existing.CaseId,
                    CaseActivityEventType.TaskUpdated,
                    "Task updated",
                    CurrentActorName());
            }
        }

        await _database.SaveChangesAsync();

        return Ok(existing);
    }

    [HttpDelete("{id:int}")]
    [EndpointSummary("Delete task")]
    [EndpointDescription(
        "Deletes the task. Leaves the case and other tasks unchanged. "
            + "Records TaskDeleted activity on the parent case in the same transaction.")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(int id)
    {
        var existing = await _database.CaseTasks.FindAsync(id);
        if (existing is null)
        {
            return NotFound();
        }

        if (await IsCaseArchived(existing.CaseId))
        {
            return ArchivedCaseConflict();
        }

        var caseId = existing.CaseId;
        _database.CaseTasks.Remove(existing);
        _activity.Record(
            caseId,
            CaseActivityEventType.TaskDeleted,
            "Task deleted",
            CurrentActorName());
        await _database.SaveChangesAsync();

        return NoContent();
    }

    private async Task<bool> IsCaseArchived(int caseId) =>
        await _database.Cases.AnyAsync(work =>
            work.Id == caseId && work.ArchivedAt != null);

    private IActionResult ArchivedCaseConflict() =>
        Problem(
            detail: "This case is archived and cannot be changed. Restore it first.",
            statusCode: StatusCodes.Status409Conflict,
            title: "Case is archived");

    private string? CurrentActorName()
    {
        var name = HttpContext?.User?.Identity?.Name?.Trim();
        return string.IsNullOrEmpty(name) ? null : name;
    }

    private async Task ValidateForCreate(CaseTask task)
    {
        if (TryReadTitle(task.Title, out var title))
        {
            task.Title = title;
        }
        else
        {
            AddTitleError(task.Title);
        }

        task.Description = NormalizeDescription(task.Description);

        if (!Enum.IsDefined(task.Priority))
        {
            ModelState.AddModelError(nameof(task.Priority), "Priority must be Low, Normal, or High.");
        }

        if (task.CaseId <= 0)
        {
            ModelState.AddModelError(nameof(task.CaseId), "Case is required.");
            return;
        }

        var caseExists = await _database.Cases.AnyAsync(work => work.Id == task.CaseId);
        if (!caseExists)
        {
            ModelState.AddModelError(nameof(task.CaseId), "Case was not found.");
        }
    }

    private bool TryReadTitle(string? value, out string title)
    {
        title = value?.Trim() ?? "";
        return title.Length > 0 && title.Length <= MaximumTitleLength;
    }

    private void AddTitleError(string? value)
    {
        var title = value?.Trim() ?? "";
        var message = title.Length == 0
            ? "Title is required."
            : "Title must be at most 200 characters.";
        ModelState.AddModelError(nameof(CaseTask.Title), message);
    }

    private static string? NormalizeDescription(string? value)
    {
        var description = value?.Trim();
        return string.IsNullOrEmpty(description) ? null : description;
    }

    private static bool TryReadStatus(string? value, out CaseTaskStatus status)
    {
        if (Enum.TryParse(value, ignoreCase: false, out status)
            && Enum.IsDefined(status)
            && status.ToString() == value)
        {
            return true;
        }

        status = default;
        return false;
    }

    private static bool TryReadPriority(string? value, out CaseTaskPriority priority)
    {
        if (Enum.TryParse(value, ignoreCase: false, out priority)
            && Enum.IsDefined(priority)
            && priority.ToString() == value)
        {
            return true;
        }

        priority = default;
        return false;
    }

    private static string PriorityLabel(CaseTaskPriority priority) => priority switch
    {
        CaseTaskPriority.Low => "Low",
        CaseTaskPriority.High => "High",
        _ => "Normal",
    };
}
