using AiBusiness.Api.Data;
using AiBusiness.Api.Models;
using AiBusiness.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace AiBusiness.Api.Controllers;

[ApiController]
[Route("api/cases")]
public class CasesController : ControllerBase
{
    private const int MaximumTitleLength = 200;

    private static readonly string[] ExportHeaders =
    [
        "Id",
        "Customer Id",
        "Customer Name",
        "Title",
        "Description",
        "Status",
        "Created At (UTC)",
        "Archived At (UTC)",
    ];

    private readonly AppDbContext _database;
    private readonly CaseActivityWriter _activity;
    private readonly CsvExportService _csvExport;
    private readonly CaseEscalationService _escalation;

    public CasesController(
        AppDbContext database,
        CaseActivityWriter activity,
        CsvExportService csvExport,
        CaseEscalationService? escalation = null)
    {
        _database = database;
        _activity = activity;
        _csvExport = csvExport;
        _escalation = escalation ?? new CaseEscalationService(
            database,
            new BusinessClock(Microsoft.Extensions.Options.Options.Create(new Options.BusinessTimezoneOptions())));
    }

    [HttpGet]
    [EndpointSummary("List cases")]
    [EndpointDescription(
        "Without `page` or `pageSize`, returns a JSON array of cases ordered newest `createdAt` first, then highest `id`. "
            + "When `page` and/or `pageSize` is present, returns `{ items, page, pageSize, totalCount }` "
            + "(defaults page=1, pageSize=20, max pageSize=100). "
            + "Optional filters: `customerId`, `status` (Open|InProgress|Closed, case-sensitive), "
            + "`search` (title or description, case-insensitive), "
            + "`archive` (active|archived|all; default active). Filters combine and apply before count/slice.")]
    [ProducesResponseType(typeof(Case[]), StatusCodes.Status200OK, Description = "Unpaginated case array when page and pageSize are omitted.")]
    [ProducesResponseType(typeof(PagedResult<Case>), StatusCodes.Status200OK, Description = "Paginated cases when page and/or pageSize is provided.")]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest, Description = "Invalid status, archive, page, or pageSize.")]
    public async Task<IActionResult> GetAll(
        [FromQuery] int? customerId = null,
        [FromQuery] string? status = null,
        [FromQuery] string? search = null,
        [FromQuery] string? archive = null,
        [FromQuery] int? page = null,
        [FromQuery] int? pageSize = null,
        [FromQuery] DateOnly? fromDate = null,
        [FromQuery] DateOnly? toDate = null)
    {
        if (!Pagination.TryResolve(
                page,
                pageSize,
                ModelState,
                out var resolvedPage,
                out var resolvedPageSize,
                out var paginate))
        {
            return ValidationProblem(ModelState);
        }

        if (!TryBuildListQuery(customerId, status, search, archive, fromDate, toDate, out var query, out var errorResult))
        {
            return errorResult!;
        }

        if (!paginate)
        {
            return Ok(await query.ToArrayAsync());
        }

        return Ok(await Pagination.ToPageAsync(query, resolvedPage, resolvedPageSize));
    }

    [HttpGet("export")]
    [EndpointSummary("Export cases CSV")]
    [EndpointDescription(
        "Exports all cases matching the optional `customerId`, `status`, `search`, `archive`, and date-range (`fromDate`, `toDate`) filters, "
            + "ordered newest `createdAt` first, then highest `id`. Not limited to the current page. "
            + "Includes customer id/name and Archived At (UTC). Returns UTF-8 CSV (with BOM). "
            + "Rejects exports larger than CsvExport:MaxRows. Does not change any records.")]
    [Produces("text/csv")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Export(
        [FromQuery] int? customerId = null,
        [FromQuery] string? status = null,
        [FromQuery] string? search = null,
        [FromQuery] string? archive = null,
        [FromQuery] DateOnly? fromDate = null,
        [FromQuery] DateOnly? toDate = null)
    {
        if (!TryBuildListQuery(customerId, status, search, archive, fromDate, toDate, out var query, out var errorResult))
        {
            return errorResult!;
        }

        var maxRows = _csvExport.MaxRows;
        var matched = await query.CountAsync();
        if (matched > maxRows)
        {
            return Problem(
                detail:
                    $"Export matches {matched} rows, which exceeds the limit of {maxRows}. "
                    + "Narrow your filters and try again.",
                statusCode: StatusCodes.Status400BadRequest,
                title: "Export too large");
        }

        var rows = await query
            .Select(work => new
            {
                work.Id,
                work.CustomerId,
                CustomerName = work.Customer != null ? work.Customer.Name : "",
                work.Title,
                work.Description,
                Status = work.Status.ToString(),
                work.CreatedAt,
                work.ArchivedAt,
            })
            .ToListAsync();

        var csvRows = rows.Select(row => (IReadOnlyList<string?>)new string?[]
        {
            row.Id.ToString(),
            row.CustomerId.ToString(),
            row.CustomerName,
            row.Title,
            row.Description,
            row.Status,
            CsvFormatter.FormatUtcTimestamp(row.CreatedAt),
            row.ArchivedAt is DateTime archivedAt
                ? CsvFormatter.FormatUtcTimestamp(archivedAt)
                : "",
        });
        var csv = CsvFormatter.Build(ExportHeaders, csvRows);
        return _csvExport.File(_csvExport.FileName("cases"), csv);
    }

    [HttpGet("{id:int}")]
    [EndpointSummary("Get case by id")]
    [EndpointDescription("Returns one case, or 404 if it does not exist.")]
    [ProducesResponseType(typeof(Case), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetById(int id)
    {
        var work = await _database.Cases.FindAsync(id);
        if (work is null)
        {
            return NotFound();
        }

        return Ok(work);
    }

    [HttpPost]
    [EndpointSummary("Create case")]
    [EndpointDescription(
        "Creates a case for an existing customer. Required: `customerId`, `title` (1–200 chars). "
            + "Optional: `description`. Server sets `id`, UTC `createdAt`, and always stores status `Open` "
            + "(client `status`/`id`/`createdAt` ignored). Returns 201 with a Location header. "
            + "Records CaseCreated activity in the same database transaction.")]
    [ProducesResponseType(typeof(Case), StatusCodes.Status201Created, Description = "Case created as Open. Location header points at the new resource.")]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest, Description = "Invalid title, missing customer, or unknown customerId.")]
    public async Task<IActionResult> Create(Case work)
    {
        await ValidateForCreate(work);
        if (!ModelState.IsValid)
        {
            return ValidationProblem(ModelState);
        }

        work.Id = 0;
        work.Status = CaseStatus.Open;
        work.ArchivedAt = null;

        await using var transaction = await _database.Database.BeginTransactionAsync();
        _database.Cases.Add(work);
        await _database.SaveChangesAsync();

        _activity.Record(
            work.Id,
            CaseActivityEventType.CaseCreated,
            "Case created",
            CurrentActorName());
        await _database.SaveChangesAsync();
        await transaction.CommitAsync();

        return CreatedAtAction(nameof(GetById), new { id = work.Id }, work);
    }

    [HttpPost("from-template")]
    [EndpointSummary("Create case from template values")]
    [EndpointDescription(
        "Creates an Open case and Todo/Normal tasks (no due dates) in one database transaction "
            + "from the submitted title, description, and task titles. "
            + "Does not re-read a stored template, so later template edits cannot change this case. "
            + "Required: `customerId`, `title` (1–200). Optional: `description`, `taskTitles` (0–50). "
            + "Records CaseCreated and TaskCreated activity. Returns 201 with the case and created tasks.")]
    [ProducesResponseType(typeof(CaseFromTemplateResult), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> CreateFromTemplate(CreateCaseFromTemplateRequest request)
    {
        var work = new Case
        {
            CustomerId = request.CustomerId,
            Title = request.Title ?? string.Empty,
            Description = request.Description,
        };
        await ValidateForCreate(work);

        var taskTitles = new List<string>();
        var rawTitles = request.TaskTitles ?? [];
        if (rawTitles.Count > CaseTemplate.MaxTaskCount)
        {
            ModelState.AddModelError(
                nameof(CreateCaseFromTemplateRequest.TaskTitles),
                $"At most {CaseTemplate.MaxTaskCount} tasks can be created.");
        }
        else
        {
            for (var index = 0; index < rawTitles.Count; index++)
            {
                var title = rawTitles[index]?.Trim() ?? string.Empty;
                if (title.Length == 0)
                {
                    ModelState.AddModelError(
                        $"{nameof(CreateCaseFromTemplateRequest.TaskTitles)}[{index}]",
                        "Task title is required.");
                }
                else if (title.Length > MaximumTitleLength)
                {
                    ModelState.AddModelError(
                        $"{nameof(CreateCaseFromTemplateRequest.TaskTitles)}[{index}]",
                        $"Title must be between 1 and {MaximumTitleLength} characters.");
                }
                else
                {
                    taskTitles.Add(title);
                }
            }
        }

        if (!ModelState.IsValid)
        {
            return ValidationProblem(ModelState);
        }

        work.Id = 0;
        work.Status = CaseStatus.Open;
        work.ArchivedAt = null;
        work.Description = NormalizeDescription(work.Description);

        await using var transaction = await _database.Database.BeginTransactionAsync();
        try
        {
            _database.Cases.Add(work);
            await _database.SaveChangesAsync();

            _activity.Record(
                work.Id,
                CaseActivityEventType.CaseCreated,
                "Case created",
                CurrentActorName());

            var createdTasks = new List<CaseTask>();
            foreach (var title in taskTitles)
            {
                var task = new CaseTask
                {
                    CaseId = work.Id,
                    Title = title,
                    Description = null,
                    DueDate = null,
                    Status = CaseTaskStatus.Todo,
                    Priority = CaseTaskPriority.Normal,
                };
                _database.CaseTasks.Add(task);
                _activity.Record(
                    work.Id,
                    CaseActivityEventType.TaskCreated,
                    "Task created",
                    CurrentActorName());
                createdTasks.Add(task);
            }

            await _database.SaveChangesAsync();
            await transaction.CommitAsync();

            return CreatedAtAction(
                nameof(GetById),
                new { id = work.Id },
                new CaseFromTemplateResult { Case = work, Tasks = createdTasks });
        }
        catch
        {
            await transaction.RollbackAsync();
            throw;
        }
    }

    [HttpPut("{id:int}")]
    [EndpointSummary("Update case")]
    [EndpointDescription(
        "Updates `title`, `description`, and `status` only. "
            + "`id`, `customerId`, and `createdAt` cannot change (body values ignored). "
            + "`status` must be exactly Open, InProgress, or Closed. "
            + "Successful field edits and status changes are recorded as activity in the same transaction.")]
    [ProducesResponseType(typeof(Case), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Update(int id, CaseUpdate changes)
    {
        var titleIsValid = TryReadTitle(changes.Title, out var title);
        var statusIsValid = TryReadStatus(changes.Status, out var status);
        if (!titleIsValid)
        {
            AddTitleError(changes.Title);
        }

        if (!statusIsValid)
        {
            ModelState.AddModelError(nameof(changes.Status), "Status must be Open, InProgress, or Closed.");
        }

        if (!ModelState.IsValid)
        {
            return ValidationProblem(ModelState);
        }

        var existing = await _database.Cases.FindAsync(id);
        if (existing is null)
        {
            return NotFound();
        }

        if (CaseArchiveRules.IsArchived(existing.ArchivedAt))
        {
            return ArchivedReadOnlyConflict();
        }

        var description = NormalizeDescription(changes.Description);
        var titleChanged = !string.Equals(existing.Title, title, StringComparison.Ordinal);
        var descriptionChanged = !string.Equals(existing.Description, description, StringComparison.Ordinal);
        var statusChanged = existing.Status != status;

        existing.Title = title;
        existing.Description = description;
        existing.Status = status;

        if (statusChanged)
        {
            _activity.Record(
                existing.Id,
                CaseActivityEventType.CaseStatusChanged,
                $"Case status changed to {StatusLabel(status)}",
                CurrentActorName());
        }

        if (titleChanged || descriptionChanged)
        {
            _activity.Record(
                existing.Id,
                CaseActivityEventType.CaseEdited,
                "Case details updated",
                CurrentActorName());
        }

        await _database.SaveChangesAsync();

        return Ok(existing);
    }

    [HttpDelete("{id:int}")]
    [EndpointSummary("Delete case")]
    [EndpointDescription(
        "Deletes the case when it has no tasks. Leaves the customer and other cases unchanged. "
            + "If the case still has tasks, returns 409 Conflict and leaves all records unchanged. "
            + "When deletion succeeds, related CaseActivities rows are removed with the case (cascade).")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict, Description = "Case has tasks and cannot be deleted.")]
    public async Task<IActionResult> Delete(int id)
    {
        _database.ChangeTracker.Clear();
        var existing = await _database.Cases.FindAsync(id);
        if (existing is null)
        {
            return NotFound();
        }

        if (CaseArchiveRules.IsArchived(existing.ArchivedAt))
        {
            return ArchivedReadOnlyConflict();
        }

        _database.Cases.Remove(existing);
        try
        {
            await _database.SaveChangesAsync();
        }
        catch (DbUpdateException exception) when (IsTasksForeignKeyViolation(exception))
        {
            _database.ChangeTracker.Clear();
            return Problem(
                detail: "This case has tasks and cannot be deleted.",
                statusCode: StatusCodes.Status409Conflict);
        }

        return NoContent();
    }

    [HttpPost("{id:int}/archive")]
    [EndpointSummary("Archive case")]
    [EndpointDescription(
        "Archives a Closed case when every related task is Done (or there are no tasks). "
            + "Sets server UTC `archivedAt`. Preserves the case, tasks, and activity history. "
            + "Records CaseArchived activity. Returns 409 when ineligible or already archived.")]
    [ProducesResponseType(typeof(Case), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Archive(int id)
    {
        var existing = await _database.Cases.FindAsync(id);
        if (existing is null)
        {
            return NotFound();
        }

        var alreadyArchived = CaseArchiveRules.IsArchived(existing.ArchivedAt);
        var hasIncomplete = await _database.CaseTasks.AnyAsync(task =>
            task.CaseId == id && task.Status != CaseTaskStatus.Done);
        if (!CaseArchiveRules.CanArchive(existing.Status, hasIncomplete, alreadyArchived))
        {
            return Problem(
                detail: CaseArchiveRules.ArchiveBlockedReason(
                    existing.Status,
                    hasIncomplete,
                    alreadyArchived),
                statusCode: StatusCodes.Status409Conflict,
                title: "Cannot archive case");
        }

        existing.ArchivedAt = UtcNow();
        _activity.Record(
            existing.Id,
            CaseActivityEventType.CaseArchived,
            "Case archived",
            CurrentActorName());
        await _database.SaveChangesAsync();

        return Ok(existing);
    }

    [HttpPost("{id:int}/restore")]
    [EndpointSummary("Restore archived case")]
    [EndpointDescription(
        "Clears `archivedAt` and leaves status Closed. Records CaseRestored activity. "
            + "Returns 409 when the case is not archived.")]
    [ProducesResponseType(typeof(Case), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Restore(int id)
    {
        var existing = await _database.Cases.FindAsync(id);
        if (existing is null)
        {
            return NotFound();
        }

        if (!CaseArchiveRules.IsArchived(existing.ArchivedAt))
        {
            return Problem(
                detail: "This case is not archived.",
                statusCode: StatusCodes.Status409Conflict,
                title: "Cannot restore case");
        }

        existing.ArchivedAt = null;
        _activity.Record(
            existing.Id,
            CaseActivityEventType.CaseRestored,
            "Case restored",
            CurrentActorName());
        await _database.SaveChangesAsync();

        return Ok(existing);
    }

    [HttpGet("{id:int}/escalation-check")]
    [EndpointSummary("Check case escalation flags")]
    [EndpointDescription(
        "Runs deterministic rule-based checks for overdue tasks, high-priority unfinished tasks, "
            + "and open/in-progress cases with no active tasks. Does not modify data or send notifications.")]
    [ProducesResponseType(typeof(CaseEscalationResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> CheckEscalation(int id, CancellationToken cancellationToken)
    {
        var result = await _escalation.CheckAsync(id, cancellationToken);
        return result.Status switch
        {
            CaseEscalationResult.StatusKind.NotFound => NotFound(new { detail = "Case not found." }),
            CaseEscalationResult.StatusKind.Archived => Problem(
                detail: "This case is archived and cannot be evaluated for escalation.",
                statusCode: StatusCodes.Status409Conflict,
                title: "Case archived"),
            _ => Ok(result.Data),
        };
    }

    private bool TryBuildListQuery(
        int? customerId,
        string? status,
        string? search,
        string? archive,
        DateOnly? fromDate,
        DateOnly? toDate,
        out IQueryable<Case> query,
        out IActionResult? errorResult)
    {
        errorResult = null;
        if (fromDate.HasValue && toDate.HasValue && fromDate.Value > toDate.Value)
        {
            ModelState.AddModelError(nameof(fromDate), "fromDate cannot be after toDate.");
            query = _database.Cases;
            errorResult = ValidationProblem(ModelState);
            return false;
        }

        CaseStatus? statusFilter = null;
        if (!string.IsNullOrWhiteSpace(status))
        {
            if (!TryReadStatus(status.Trim(), out var parsed))
            {
                ModelState.AddModelError(nameof(status), "Status must be Open, InProgress, or Closed.");
                query = _database.Cases;
                errorResult = ValidationProblem(ModelState);
                return false;
            }

            statusFilter = parsed;
        }

        var archiveFilter = "active";
        if (!string.IsNullOrWhiteSpace(archive))
        {
            archiveFilter = archive.Trim();
            if (archiveFilter is not ("active" or "archived" or "all"))
            {
                ModelState.AddModelError(nameof(archive), "archive must be active, archived, or all.");
                query = _database.Cases;
                errorResult = ValidationProblem(ModelState);
                return false;
            }
        }

        query = _database.Cases.AsNoTracking().AsQueryable();
        if (customerId is int id)
        {
            query = query.Where(work => work.CustomerId == id);
        }

        if (statusFilter is CaseStatus selectedStatus)
        {
            query = query.Where(work => work.Status == selectedStatus);
        }

        query = archiveFilter switch
        {
            "archived" => query.Where(work => work.ArchivedAt != null),
            "all" => query,
            _ => query.Where(work => work.ArchivedAt == null),
        };

        var term = search?.Trim();
        if (!string.IsNullOrEmpty(term))
        {
            var needle = term.ToLower();
            query = query.Where(work =>
                work.Title.ToLower().Contains(needle)
                || (work.Description != null && work.Description.ToLower().Contains(needle)));
        }

        if (fromDate is DateOnly start)
        {
            var startUtc = start.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
            query = query.Where(work => work.CreatedAt >= startUtc);
        }

        if (toDate is DateOnly end)
        {
            var nextDayUtc = end.AddDays(1).ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
            query = query.Where(work => work.CreatedAt < nextDayUtc);
        }

        query = query
            .OrderByDescending(work => work.CreatedAt)
            .ThenByDescending(work => work.Id);
        return true;
    }

    private IActionResult ArchivedReadOnlyConflict() =>
        Problem(
            detail: "This case is archived and cannot be changed. Restore it first.",
            statusCode: StatusCodes.Status409Conflict,
            title: "Case is archived");

    private static DateTime UtcNow()
    {
        var now = DateTime.UtcNow;
        var ticks = now.Ticks - (now.Ticks % TimeSpan.TicksPerMicrosecond);
        return new DateTime(ticks, DateTimeKind.Utc);
    }

    private string? CurrentActorName()
    {
        var name = HttpContext?.User?.Identity?.Name?.Trim();
        return string.IsNullOrEmpty(name) ? null : name;
    }

    private static string StatusLabel(CaseStatus status) => status switch
    {
        CaseStatus.InProgress => "In progress",
        CaseStatus.Closed => "Closed",
        _ => "Open",
    };

    private static bool IsTasksForeignKeyViolation(DbUpdateException exception)
    {
        for (Exception? current = exception; current is not null; current = current.InnerException)
        {
            if (current is PostgresException postgres)
            {
                return postgres.SqlState == PostgresErrorCodes.ForeignKeyViolation
                    && (postgres.ConstraintName == "FK_CaseTasks_Cases_CaseId"
                        || postgres.Message.Contains(
                            "FK_CaseTasks_Cases_CaseId",
                            StringComparison.Ordinal));
            }

            if (current.GetType().FullName == "Microsoft.Data.Sqlite.SqliteException"
                && current.Message.Contains("FOREIGN KEY constraint failed", StringComparison.Ordinal))
            {
                return true;
            }
        }

        return false;
    }

    private async Task ValidateForCreate(Case work)
    {
        if (TryReadTitle(work.Title, out var title))
        {
            work.Title = title;
        }
        else
        {
            AddTitleError(work.Title);
        }

        work.Description = NormalizeDescription(work.Description);

        if (work.CustomerId <= 0)
        {
            ModelState.AddModelError(nameof(work.CustomerId), "Customer is required.");
            return;
        }

        var customerExists = await _database.Customers
            .AnyAsync(customer => customer.Id == work.CustomerId);
        if (!customerExists)
        {
            ModelState.AddModelError(nameof(work.CustomerId), "Customer was not found.");
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
        ModelState.AddModelError(nameof(Case.Title), message);
    }

    private static string? NormalizeDescription(string? value)
    {
        var description = value?.Trim();
        return string.IsNullOrEmpty(description) ? null : description;
    }

    private static bool TryReadStatus(string? value, out CaseStatus status)
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
}
