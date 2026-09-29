using AiBusiness.Api.Data;
using AiBusiness.Api.Models;
using AiBusiness.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AiBusiness.Api.Controllers;

[ApiController]
[Route("api/customers/{customerId:int}/activity")]
public class CustomerActivityController : ControllerBase
{
    private readonly AppDbContext _database;

    public CustomerActivityController(AppDbContext database)
    {
        _database = database;
    }

    [HttpGet]
    [EndpointSummary("List customer activity")]
    [EndpointDescription(
        "Returns product activity across all cases belonging to one customer, newest first (`occurredAt`, then `id`). "
            + "Always paginated: defaults page=1, pageSize=20 (max 100). "
            + "Returns 404 when the customer does not exist.")]
    [ProducesResponseType(typeof(PagedResult<CustomerActivityItem>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetForCustomer(
        int customerId,
        [FromQuery] int? page = null,
        [FromQuery] int? pageSize = null)
    {
        var customerExists = await _database.Customers.AnyAsync(c => c.Id == customerId);
        if (!customerExists)
        {
            return NotFound();
        }

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

        var query = _database.CaseActivities
            .AsNoTracking()
            .Where(activity => activity.Case != null && activity.Case.CustomerId == customerId)
            .OrderByDescending(activity => activity.OccurredAt)
            .ThenByDescending(activity => activity.Id)
            .Select(activity => new CustomerActivityItem
            {
                Id = activity.Id,
                CaseId = activity.CaseId,
                CaseTitle = activity.Case != null ? activity.Case.Title : string.Empty,
                EventType = activity.EventType,
                Description = activity.Description,
                OccurredAt = activity.OccurredAt,
                ActorName = activity.ActorName,
            });

        return Ok(await Pagination.ToPageAsync(query, resolvedPage, resolvedPageSize));
    }
}
