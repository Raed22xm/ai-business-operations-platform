using System.ComponentModel.DataAnnotations;
using AiBusiness.Api.Data;
using AiBusiness.Api.Models;
using AiBusiness.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace AiBusiness.Api.Controllers;

[ApiController]
[Route("api/customers")]
public class CustomersController : ControllerBase
{
    private static readonly string[] ExportHeaders =
    [
        "Id",
        "Name",
        "Email",
        "Phone",
        "Company",
        "Created At (UTC)",
    ];

    private readonly AppDbContext _database;
    private readonly CsvExportService _csvExport;

    public CustomersController(AppDbContext database, CsvExportService csvExport)
    {
        _database = database;
        _csvExport = csvExport;
    }

    /// <summary>
    /// Lists customers. Omit page and pageSize for a full array; provide either to paginate.
    /// </summary>
    [HttpGet]
    [EndpointSummary("List customers")]
    [EndpointDescription(
        "Without `page` or `pageSize`, returns a JSON array of customers ordered by `id`. "
            + "When `page` and/or `pageSize` is present, returns `{ items, page, pageSize, totalCount }` "
            + "with defaults page=1, pageSize=20 (maximum pageSize=100). "
            + "Optional `search` matches name, email, or company (case-insensitive substring) and applies before count/slice. "
            + "Out-of-range pages return empty `items` with the correct `totalCount`.")]
    [ProducesResponseType(typeof(Customer[]), StatusCodes.Status200OK, Description = "Unpaginated customer array when page and pageSize are omitted.")]
    [ProducesResponseType(typeof(PagedResult<Customer>), StatusCodes.Status200OK, Description = "Paginated customers when page and/or pageSize is provided.")]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest, Description = "Invalid page (must be ≥ 1) or pageSize (1–100).")]
    public async Task<IActionResult> GetAll(
        [FromQuery] string? search = null,
        [FromQuery] int? page = null,
        [FromQuery] int? pageSize = null,
        [FromQuery] DateOnly? fromDate = null,
        [FromQuery] DateOnly? toDate = null)
    {
        if (fromDate.HasValue && toDate.HasValue && fromDate.Value > toDate.Value)
        {
            ModelState.AddModelError(nameof(fromDate), "fromDate cannot be after toDate.");
            return ValidationProblem(ModelState);
        }

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

        var query = BuildListQuery(search, fromDate, toDate);

        if (!paginate)
        {
            return Ok(await query.ToArrayAsync());
        }

        return Ok(await Pagination.ToPageAsync(query, resolvedPage, resolvedPageSize));
    }

    [HttpGet("export")]
    [EndpointSummary("Export customers CSV")]
    [EndpointDescription(
        "Exports all customers matching the optional `search` and date-range (`fromDate`, `toDate`) filters, "
            + "ordered by `id`. Not limited to the current page. "
            + "Returns UTF-8 CSV (with BOM). Rejects exports larger than CsvExport:MaxRows. "
            + "Does not change any records.")]
    [Produces("text/csv")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Export(
        [FromQuery] string? search = null,
        [FromQuery] DateOnly? fromDate = null,
        [FromQuery] DateOnly? toDate = null)
    {
        if (fromDate.HasValue && toDate.HasValue && fromDate.Value > toDate.Value)
        {
            ModelState.AddModelError(nameof(fromDate), "fromDate cannot be after toDate.");
            return ValidationProblem(ModelState);
        }

        var maxRows = _csvExport.MaxRows;
        var query = BuildListQuery(search, fromDate, toDate);
        var matched = await query.CountAsync();
        if (matched > maxRows)
        {
            return Problem(
                detail:
                    $"Export matches {matched} rows, which exceeds the limit of {maxRows}. "
                    + "Narrow your search and try again.",
                statusCode: StatusCodes.Status400BadRequest,
                title: "Export too large");
        }

        var customers = await query.ToListAsync();
        var rows = customers.Select(customer => (IReadOnlyList<string?>)new string?[]
        {
            customer.Id.ToString(),
            customer.Name,
            customer.Email,
            customer.Phone,
            customer.Company,
            CsvFormatter.FormatUtcTimestamp(customer.CreatedAt),
        });
        var csv = CsvFormatter.Build(ExportHeaders, rows);
        return _csvExport.File(_csvExport.FileName("customers"), csv);
    }

    [HttpGet("{id:int}")]
    [EndpointSummary("Get customer by id")]
    [EndpointDescription("Returns one customer, or 404 if it does not exist.")]
    [ProducesResponseType(typeof(Customer), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound, Description = "No customer with that id.")]
    public async Task<IActionResult> GetById(int id)
    {
        var customer = await _database.Customers.FindAsync(id);
        if (customer is null)
        {
            return NotFound();
        }

        return Ok(customer);
    }

    [HttpPost]
    [EndpointSummary("Create customer")]
    [EndpointDescription(
        "Creates a customer. Required: `name`, `email`. Optional: `phone`, `company`. "
            + "Server sets `id` and UTC `createdAt` (client values ignored). "
            + "Returns 201 with a Location header to GET /api/customers/{id}.")]
    [ProducesResponseType(typeof(Customer), StatusCodes.Status201Created, Description = "Customer created. Location header points at the new resource.")]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest, Description = "Missing/blank name or email, or invalid email format.")]
    public async Task<IActionResult> Create(Customer customer)
    {
        ValidateNameAndEmail(customer);

        if (!ModelState.IsValid)
        {
            return ValidationProblem(ModelState);
        }

        customer.Id = 0;
        customer.CreatedAt = UtcNow();
        _database.Customers.Add(customer);
        await _database.SaveChangesAsync();

        return CreatedAtAction(nameof(GetById), new { id = customer.Id }, customer);
    }

    [HttpPut("{id:int}")]
    [EndpointSummary("Update customer")]
    [EndpointDescription(
        "Updates `name`, `email`, `phone`, and `company`. "
            + "`id` and `createdAt` are preserved (body values for those fields are ignored).")]
    [ProducesResponseType(typeof(Customer), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound, Description = "No customer with that id.")]
    public async Task<IActionResult> Update(int id, Customer customer)
    {
        ValidateNameAndEmail(customer);

        if (!ModelState.IsValid)
        {
            return ValidationProblem(ModelState);
        }

        var existing = await _database.Customers.FindAsync(id);
        if (existing is null)
        {
            return NotFound();
        }

        existing.Name = customer.Name;
        existing.Email = customer.Email;
        existing.Phone = customer.Phone;
        existing.Company = customer.Company;
        await _database.SaveChangesAsync();

        return Ok(existing);
    }

    [HttpDelete("{id:int}")]
    [EndpointSummary("Delete customer")]
    [EndpointDescription(
        "Deletes the customer when it has no cases. "
            + "If the customer still has cases, returns 409 Conflict and leaves all records unchanged. "
            + "When deletion succeeds, related CustomerNotes rows are removed with the customer (cascade).")]
    [ProducesResponseType(StatusCodes.Status204NoContent, Description = "Customer deleted.")]
    [ProducesResponseType(StatusCodes.Status404NotFound, Description = "No customer with that id.")]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict, Description = "Customer has cases and cannot be deleted.")]
    public async Task<IActionResult> Delete(int id)
    {
        _database.ChangeTracker.Clear();
        var existing = await _database.Customers.FindAsync(id);
        if (existing is null)
        {
            return NotFound();
        }

        _database.Customers.Remove(existing);
        try
        {
            await _database.SaveChangesAsync();
        }
        catch (DbUpdateException exception) when (IsCasesForeignKeyViolation(exception))
        {
            _database.ChangeTracker.Clear();
            return Problem(
                detail: "This customer has cases and cannot be deleted.",
                statusCode: StatusCodes.Status409Conflict);
        }

        return NoContent();
    }

    private IQueryable<Customer> BuildListQuery(
        string? search,
        DateOnly? fromDate = null,
        DateOnly? toDate = null)
    {
        var query = _database.Customers.AsNoTracking().AsQueryable();
        var term = search?.Trim();
        if (!string.IsNullOrEmpty(term))
        {
            var needle = term.ToLower();
            query = query.Where(customer =>
                customer.Name.ToLower().Contains(needle)
                || customer.Email.ToLower().Contains(needle)
                || (customer.Company != null && customer.Company.ToLower().Contains(needle)));
        }

        if (fromDate is DateOnly start)
        {
            var startUtc = start.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
            query = query.Where(customer => customer.CreatedAt >= startUtc);
        }

        if (toDate is DateOnly end)
        {
            var nextDayUtc = end.AddDays(1).ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
            query = query.Where(customer => customer.CreatedAt < nextDayUtc);
        }

        return query.OrderBy(customer => customer.Id);
    }

    private static bool IsCasesForeignKeyViolation(DbUpdateException exception)
    {
        for (Exception? current = exception; current is not null; current = current.InnerException)
        {
            if (current is PostgresException postgres)
            {
                return postgres.SqlState == PostgresErrorCodes.ForeignKeyViolation
                    && (postgres.ConstraintName == "FK_Cases_Customers_CustomerId"
                        || postgres.Message.Contains(
                            "FK_Cases_Customers_CustomerId",
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

    private void ValidateNameAndEmail(Customer customer)
    {
        if (string.IsNullOrWhiteSpace(customer.Name))
        {
            ModelState.AddModelError(nameof(customer.Name), "Name is required.");
        }

        if (string.IsNullOrWhiteSpace(customer.Email))
        {
            ModelState.AddModelError(nameof(customer.Email), "Email is required.");
        }
        else if (!new EmailAddressAttribute().IsValid(customer.Email))
        {
            ModelState.AddModelError(nameof(customer.Email), "Email format is invalid.");
        }
    }

    // PostgreSQL stores timestamps to the microsecond. Trim the extra .NET precision
    // so a value read back from the database still matches the value we saved.
    private static DateTime UtcNow()
    {
        var now = DateTime.UtcNow;
        var ticks = now.Ticks - (now.Ticks % TimeSpan.TicksPerMicrosecond);
        return new DateTime(ticks, DateTimeKind.Utc);
    }
}
