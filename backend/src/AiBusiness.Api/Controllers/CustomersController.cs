using System.ComponentModel.DataAnnotations;
using AiBusiness.Api.Data;
using AiBusiness.Api.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace AiBusiness.Api.Controllers;

[ApiController]
[Route("api/customers")]
public class CustomersController : ControllerBase
{
    private readonly AppDbContext _database;

    public CustomersController(AppDbContext database)
    {
        _database = database;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var customers = await _database.Customers
            .OrderBy(customer => customer.Id)
            .ToArrayAsync();
        return Ok(customers);
    }

    [HttpGet("{id:int}")]
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
    public async Task<IActionResult> Delete(int id)
    {
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
