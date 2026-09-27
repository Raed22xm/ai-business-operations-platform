using AiBusiness.Api.Data;
using AiBusiness.Api.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AiBusiness.Api.Controllers;

[ApiController]
[Route("api/tasks")]
public class TasksController : ControllerBase
{
    private const int MaximumTitleLength = 200;
    private readonly AppDbContext _database;

    public TasksController(AppDbContext database)
    {
        _database = database;
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
            + "Optional: `description`, `dueDate` (date only, YYYY-MM-DD). "
            + "Server sets `id`, UTC `createdAt`, and always stores status `Todo` "
            + "(client `status`/`id`/`createdAt` ignored). Returns 201 with a Location header.")]
    [ProducesResponseType(typeof(CaseTask), StatusCodes.Status201Created, Description = "Task created as Todo. Location header points at the new resource.")]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Create(CaseTask task)
    {
        await ValidateForCreate(task);
        if (!ModelState.IsValid)
        {
            return ValidationProblem(ModelState);
        }

        task.Id = 0;
        task.Status = CaseTaskStatus.Todo;
        _database.CaseTasks.Add(task);
        await _database.SaveChangesAsync();

        return CreatedAtAction(nameof(GetById), new { id = task.Id }, task);
    }

    [HttpPut("{id:int}")]
    [EndpointSummary("Update task")]
    [EndpointDescription(
        "Updates `title`, `description`, `dueDate`, and `status` only. "
            + "`id`, `caseId`, and `createdAt` cannot change (body values ignored). "
            + "`status` must be exactly Todo, InProgress, or Done. "
            + "Null/blank description or null dueDate clears those fields.")]
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

        if (!ModelState.IsValid)
        {
            return ValidationProblem(ModelState);
        }

        var existing = await _database.CaseTasks.FindAsync(id);
        if (existing is null)
        {
            return NotFound();
        }

        existing.Title = title;
        existing.Description = NormalizeDescription(changes.Description);
        existing.DueDate = changes.DueDate;
        existing.Status = status;
        await _database.SaveChangesAsync();

        return Ok(existing);
    }

    [HttpDelete("{id:int}")]
    [EndpointSummary("Delete task")]
    [EndpointDescription("Deletes the task. Leaves the case and other tasks unchanged.")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(int id)
    {
        var existing = await _database.CaseTasks.FindAsync(id);
        if (existing is null)
        {
            return NotFound();
        }

        _database.CaseTasks.Remove(existing);
        await _database.SaveChangesAsync();

        return NoContent();
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
}
