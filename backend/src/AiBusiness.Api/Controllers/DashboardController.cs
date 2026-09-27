using AiBusiness.Api.Data;
using AiBusiness.Api.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AiBusiness.Api.Controllers;

[ApiController]
[Route("api/dashboard")]
public class DashboardController : ControllerBase
{
    private readonly AppDbContext _database;

    public DashboardController(AppDbContext database)
    {
        _database = database;
    }

    [HttpGet("summary")]
    [EndpointSummary("Dashboard summary")]
    [EndpointDescription(
        "Returns count totals calculated in the database: totalCustomers, totalCases, "
            + "openCases, inProgressCases, and closedCases. Empty tables return zeros.")]
    [ProducesResponseType(typeof(DashboardSummary), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetSummary()
    {
        var totalCustomers = await _database.Customers.CountAsync();
        var totalCases = await _database.Cases.CountAsync();
        var openCases = await _database.Cases.CountAsync(work => work.Status == CaseStatus.Open);
        var inProgressCases = await _database.Cases.CountAsync(
            work => work.Status == CaseStatus.InProgress);
        var closedCases = await _database.Cases.CountAsync(work => work.Status == CaseStatus.Closed);

        return Ok(new DashboardSummary
        {
            TotalCustomers = totalCustomers,
            TotalCases = totalCases,
            OpenCases = openCases,
            InProgressCases = inProgressCases,
            ClosedCases = closedCases,
        });
    }
}
