using AiBusiness.Api.Data;
using AiBusiness.Api.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AiBusiness.Api.Controllers;

[ApiController]
[Route("api/case-templates")]
public class CaseTemplatesController : ControllerBase
{
    private readonly AppDbContext _database;

    public CaseTemplatesController(AppDbContext database)
    {
        _database = database;
    }

    [HttpGet]
    [EndpointSummary("List case templates")]
    [EndpointDescription(
        "Returns all case templates ordered by name then id, each including ordered task titles. "
            + "Auth required.")]
    [ProducesResponseType(typeof(CaseTemplate[]), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetAll()
    {
        var templates = await TemplatesQuery().ToArrayAsync();
        return Ok(templates);
    }

    [HttpGet("{id:int}")]
    [EndpointSummary("Get case template by id")]
    [EndpointDescription("Returns one template with ordered task titles, or 404.")]
    [ProducesResponseType(typeof(CaseTemplate), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetById(int id)
    {
        var template = await TemplatesQuery().FirstOrDefaultAsync(item => item.Id == id);
        if (template is null)
        {
            return NotFound();
        }

        return Ok(template);
    }

    [HttpPost]
    [EndpointSummary("Create case template")]
    [EndpointDescription(
        "Creates a template. Required: `name` (1–200 chars). Optional: `description` (max 5,000), "
            + "`taskTitles` (0–50 non-blank titles, each 1–200 chars). "
            + "Templates do not store customers or due dates. Auth required.")]
    [ProducesResponseType(typeof(CaseTemplate), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Create(CaseTemplateWrite input)
    {
        if (!TryReadWrite(input, out var name, out var description, out var taskTitles))
        {
            return ValidationProblem(ModelState);
        }

        var template = new CaseTemplate
        {
            Name = name,
            Description = description,
            Tasks = taskTitles
                .Select((title, index) => new CaseTemplateTask
                {
                    Title = title,
                    SortOrder = index,
                })
                .ToList(),
        };

        _database.CaseTemplates.Add(template);
        await _database.SaveChangesAsync();

        return CreatedAtAction(nameof(GetById), new { id = template.Id }, await LoadTemplate(template.Id));
    }

    [HttpPut("{id:int}")]
    [EndpointSummary("Update case template")]
    [EndpointDescription(
        "Replaces name, description, and the full ordered task-title list. "
            + "Does not change cases previously created from this template. Auth required.")]
    [ProducesResponseType(typeof(CaseTemplate), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Update(int id, CaseTemplateWrite input)
    {
        if (!TryReadWrite(input, out var name, out var description, out var taskTitles))
        {
            return ValidationProblem(ModelState);
        }

        var existing = await _database.CaseTemplates
            .Include(template => template.Tasks)
            .FirstOrDefaultAsync(template => template.Id == id);
        if (existing is null)
        {
            return NotFound();
        }

        existing.Name = name;
        existing.Description = description;
        _database.CaseTemplateTasks.RemoveRange(existing.Tasks);
        existing.Tasks = taskTitles
            .Select((title, index) => new CaseTemplateTask
            {
                Title = title,
                SortOrder = index,
            })
            .ToList();

        await _database.SaveChangesAsync();
        return Ok(await LoadTemplate(existing.Id));
    }

    [HttpDelete("{id:int}")]
    [EndpointSummary("Delete case template")]
    [EndpointDescription(
        "Deletes the template and its task titles. Cases previously created from it are unchanged. "
            + "Auth required.")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(int id)
    {
        var existing = await _database.CaseTemplates.FindAsync(id);
        if (existing is null)
        {
            return NotFound();
        }

        _database.CaseTemplates.Remove(existing);
        await _database.SaveChangesAsync();
        return NoContent();
    }

    private IQueryable<CaseTemplate> TemplatesQuery() =>
        _database.CaseTemplates
            .AsNoTracking()
            .Include(template => template.Tasks.OrderBy(task => task.SortOrder).ThenBy(task => task.Id))
            .OrderBy(template => template.Name)
            .ThenBy(template => template.Id);

    private async Task<CaseTemplate> LoadTemplate(int id) =>
        (await TemplatesQuery().FirstAsync(template => template.Id == id));

    private bool TryReadWrite(
        CaseTemplateWrite input,
        out string name,
        out string? description,
        out List<string> taskTitles)
    {
        name = string.Empty;
        description = null;
        taskTitles = [];

        var rawName = input.Name?.Trim() ?? string.Empty;
        if (rawName.Length == 0)
        {
            ModelState.AddModelError(nameof(CaseTemplateWrite.Name), "Name is required.");
        }
        else if (rawName.Length > CaseTemplate.MaxNameLength)
        {
            ModelState.AddModelError(
                nameof(CaseTemplateWrite.Name),
                $"Name must be at most {CaseTemplate.MaxNameLength} characters.");
        }
        else
        {
            name = rawName;
        }

        if (input.Description is not null)
        {
            var trimmed = input.Description.Trim();
            if (trimmed.Length == 0)
            {
                description = null;
            }
            else if (trimmed.Length > CaseTemplate.MaxDescriptionLength)
            {
                ModelState.AddModelError(
                    nameof(CaseTemplateWrite.Description),
                    $"Description must be at most {CaseTemplate.MaxDescriptionLength} characters.");
            }
            else
            {
                description = trimmed;
            }
        }

        var rawTitles = input.TaskTitles ?? [];
        if (rawTitles.Count > CaseTemplate.MaxTaskCount)
        {
            ModelState.AddModelError(
                nameof(CaseTemplateWrite.TaskTitles),
                $"A template can have at most {CaseTemplate.MaxTaskCount} tasks.");
        }
        else
        {
            for (var index = 0; index < rawTitles.Count; index++)
            {
                var title = rawTitles[index]?.Trim() ?? string.Empty;
                if (title.Length == 0)
                {
                    ModelState.AddModelError(
                        $"{nameof(CaseTemplateWrite.TaskTitles)}[{index}]",
                        "Task title is required.");
                }
                else if (title.Length > CaseTemplate.MaxTaskTitleLength)
                {
                    ModelState.AddModelError(
                        $"{nameof(CaseTemplateWrite.TaskTitles)}[{index}]",
                        $"Task title must be at most {CaseTemplate.MaxTaskTitleLength} characters.");
                }
                else
                {
                    taskTitles.Add(title);
                }
            }
        }

        return ModelState.IsValid;
    }
}
