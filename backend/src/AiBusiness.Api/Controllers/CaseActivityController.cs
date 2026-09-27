using AiBusiness.Api.Data;
using AiBusiness.Api.Models;
using AiBusiness.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AiBusiness.Api.Controllers;

[ApiController]
[Route("api/cases/{caseId:int}/activity")]
public class CaseActivityController : ControllerBase
{
    private readonly AppDbContext _database;

    public CaseActivityController(AppDbContext database)
    {
        _database = database;
    }

    [HttpGet]
    [EndpointSummary("List case activity")]
    [EndpointDescription(
        "Returns product activity for one case, newest first (`occurredAt`, then `id`). "
            + "Always paginated: defaults page=1, pageSize=20 (max 100). "
            + "History starts when activity recording was enabled — older cases may have an empty timeline. "
            + "Read-only; there is no API to edit or delete activity rows. "
            + "Returns 404 when the case does not exist.")]
    [ProducesResponseType(typeof(PagedResult<CaseActivity>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetForCase(
        int caseId,
        [FromQuery] int? page = null,
        [FromQuery] int? pageSize = null)
    {
        var caseExists = await _database.Cases.AnyAsync(work => work.Id == caseId);
        if (!caseExists)
        {
            return NotFound();
        }

        // Always paginate for a stable feed (Load more on the case details page).
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

        // Force paginate path even when both query values were omitted.
        var query = _database.CaseActivities
            .AsNoTracking()
            .Where(activity => activity.CaseId == caseId)
            .OrderByDescending(activity => activity.OccurredAt)
            .ThenByDescending(activity => activity.Id);

        return Ok(await Pagination.ToPageAsync(query, resolvedPage, resolvedPageSize));
    }
}
