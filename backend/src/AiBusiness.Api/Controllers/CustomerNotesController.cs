using AiBusiness.Api.Data;
using AiBusiness.Api.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AiBusiness.Api.Controllers;

[ApiController]
[Route("api/customers/{customerId:int}/notes")]
public class CustomerNotesController : ControllerBase
{
    private readonly AppDbContext _database;

    public CustomerNotesController(AppDbContext database)
    {
        _database = database;
    }

    [HttpGet]
    [EndpointSummary("List customer notes")]
    [EndpointDescription(
        "Returns notes for one customer, newest first (`createdAt`, then `id`). "
            + "Always paginated: defaults page=1, pageSize=20 (max 100). "
            + "Returns 404 when the customer does not exist. Auth required.")]
    [ProducesResponseType(typeof(PagedResult<CustomerNote>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetForCustomer(
        int customerId,
        [FromQuery] int? page = null,
        [FromQuery] int? pageSize = null)
    {
        if (!await CustomerExists(customerId))
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

        var query = _database.CustomerNotes
            .AsNoTracking()
            .Where(note => note.CustomerId == customerId)
            .OrderByDescending(note => note.CreatedAt)
            .ThenByDescending(note => note.Id);

        return Ok(await Pagination.ToPageAsync(query, resolvedPage, resolvedPageSize));
    }

    [HttpPost]
    [EndpointSummary("Create customer note")]
    [EndpointDescription(
        "Creates a plain-text note for an existing customer. "
            + "Server sets `id`, `authorName` (authenticated user), UTC `createdAt`, and clears `updatedAt`. "
            + "Content is trimmed; blank or over 5,000 characters returns 400. "
            + "Returns 404 when the customer does not exist.")]
    [ProducesResponseType(typeof(CustomerNote), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Create(int customerId, CustomerNote note)
    {
        if (!await CustomerExists(customerId))
        {
            return NotFound();
        }

        ValidateContent(note.Content);
        if (!ModelState.IsValid)
        {
            return ValidationProblem(ModelState);
        }

        var author = CurrentActorName();
        if (author is null)
        {
            return Problem(
                detail: "Authenticated author is required to create a note.",
                statusCode: StatusCodes.Status401Unauthorized,
                title: "Author required");
        }

        note.Id = 0;
        note.CustomerId = customerId;
        note.Content = note.Content.Trim();
        note.AuthorName = author;
        note.CreatedAt = UtcNow();
        note.UpdatedAt = null;

        _database.CustomerNotes.Add(note);
        await _database.SaveChangesAsync();

        return CreatedAtAction(
            nameof(GetForCustomer),
            new { customerId, page = 1, pageSize = 1 },
            note);
    }

    [HttpPut("{noteId:int}")]
    [EndpointSummary("Update customer note")]
    [EndpointDescription(
        "Updates note content only. Preserves `authorName` and `createdAt`. "
            + "Sets UTC `updatedAt`. Returns 404 when the customer or note is missing, "
            + "or when the note does not belong to that customer.")]
    [ProducesResponseType(typeof(CustomerNote), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Update(int customerId, int noteId, CustomerNote incoming)
    {
        if (!await CustomerExists(customerId))
        {
            return NotFound();
        }

        ValidateContent(incoming.Content);
        if (!ModelState.IsValid)
        {
            return ValidationProblem(ModelState);
        }

        var existing = await _database.CustomerNotes
            .FirstOrDefaultAsync(note => note.Id == noteId && note.CustomerId == customerId);
        if (existing is null)
        {
            return NotFound();
        }

        existing.Content = incoming.Content.Trim();
        existing.UpdatedAt = UtcNow();
        await _database.SaveChangesAsync();

        return Ok(existing);
    }

    [HttpDelete("{noteId:int}")]
    [EndpointSummary("Delete customer note")]
    [EndpointDescription(
        "Deletes one note. Leaves the customer and other notes unchanged. "
            + "Returns 404 when the customer or note is missing, or when the note does not belong to that customer. "
            + "When a customer is deleted, all of that customer's notes are removed with them (cascade).")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(int customerId, int noteId)
    {
        if (!await CustomerExists(customerId))
        {
            return NotFound();
        }

        var existing = await _database.CustomerNotes
            .FirstOrDefaultAsync(note => note.Id == noteId && note.CustomerId == customerId);
        if (existing is null)
        {
            return NotFound();
        }

        _database.CustomerNotes.Remove(existing);
        await _database.SaveChangesAsync();
        return NoContent();
    }

    private async Task<bool> CustomerExists(int customerId) =>
        await _database.Customers.AnyAsync(customer => customer.Id == customerId);

    private void ValidateContent(string? content)
    {
        var trimmed = content?.Trim() ?? "";
        if (trimmed.Length == 0)
        {
            ModelState.AddModelError(nameof(CustomerNote.Content), "Content is required.");
            return;
        }

        if (trimmed.Length > CustomerNote.MaxContentLength)
        {
            ModelState.AddModelError(
                nameof(CustomerNote.Content),
                $"Content must be at most {CustomerNote.MaxContentLength} characters.");
        }
    }

    private string? CurrentActorName()
    {
        var name = HttpContext?.User?.Identity?.Name?.Trim();
        return string.IsNullOrEmpty(name) ? null : name;
    }

    private static DateTime UtcNow()
    {
        var now = DateTime.UtcNow;
        var ticks = now.Ticks - (now.Ticks % TimeSpan.TicksPerMicrosecond);
        return new DateTime(ticks, DateTimeKind.Utc);
    }
}
