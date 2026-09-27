using AiBusiness.Api.Data;
using AiBusiness.Api.Models;
using AiBusiness.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AiBusiness.Api.Controllers;

[ApiController]
[Route("api/cases/{caseId:int}/drafts")]
[Authorize]
public class ResponseDraftsController : ControllerBase
{
    private readonly AppDbContext _database;
    private readonly CaseActivityWriter _activity;
    private readonly CaseAssistantService _assistant;

    public ResponseDraftsController(
        AppDbContext database,
        CaseActivityWriter activity,
        CaseAssistantService assistant)
    {
        _database = database;
        _activity = activity;
        _assistant = assistant;
    }

    [HttpGet]
    [EndpointSummary("List response drafts for a case")]
    [EndpointDescription("Returns all response drafts saved for the specified case, newest first.")]
    [ProducesResponseType(typeof(ResponseDraft[]), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetAll(int caseId, CancellationToken cancellationToken)
    {
        var caseExists = await _database.Cases.AnyAsync(c => c.Id == caseId, cancellationToken);
        if (!caseExists)
        {
            return NotFound();
        }

        var drafts = await _database.ResponseDrafts
            .AsNoTracking()
            .Where(d => d.CaseId == caseId)
            .OrderByDescending(d => d.CreatedAt)
            .ThenByDescending(d => d.Id)
            .ToListAsync(cancellationToken);

        return Ok(drafts);
    }

    [HttpGet("{draftId:int}")]
    [EndpointSummary("Get one response draft")]
    [EndpointDescription("Returns a single response draft by ID if it belongs to the specified case.")]
    [ProducesResponseType(typeof(ResponseDraft), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetById(int caseId, int draftId, CancellationToken cancellationToken)
    {
        var draft = await _database.ResponseDrafts
            .AsNoTracking()
            .FirstOrDefaultAsync(d => d.Id == draftId && d.CaseId == caseId, cancellationToken);

        if (draft is null)
        {
            return NotFound();
        }

        return Ok(draft);
    }

    [HttpPost]
    [EndpointSummary("Save a new response draft")]
    [EndpointDescription(
        "Saves a new response draft for a case. Requires content and authenticated user. " +
        "Initial status is always Draft. Server sets UTC createdAt and initial version.")]
    [ProducesResponseType(typeof(ResponseDraft), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Create(
        int caseId,
        CreateResponseDraftRequest request,
        CancellationToken cancellationToken)
    {
        var work = await _database.Cases.FindAsync(new object[] { caseId }, cancellationToken);
        if (work is null)
        {
            return NotFound();
        }

        if (work.ArchivedAt is not null)
        {
            return ArchivedReadOnlyConflict();
        }

        ValidateDraftContent(request.Content);
        if (!ModelState.IsValid)
        {
            return ValidationProblem(ModelState);
        }

        var draft = new ResponseDraft
        {
            CaseId = caseId,
            Content = request.Content.Trim(),
            Source = request.Source,
            Status = ResponseDraftStatus.Draft,
            CreatedBy = CurrentActorName(),
            CreatedAt = UtcNow(),
            Version = 1,
        };

        _database.ResponseDrafts.Add(draft);
        await _database.SaveChangesAsync(cancellationToken);

        _activity.Record(
            caseId,
            CaseActivityEventType.DraftCreated,
            $"Response draft created ({draft.Source})",
            CurrentActorName());
        await _database.SaveChangesAsync(cancellationToken);

        return CreatedAtAction(
            nameof(GetById),
            new { caseId, draftId = draft.Id },
            draft);
    }

    [HttpPost("generate-and-save")]
    [EndpointSummary("Generate AI response draft and save")]
    [EndpointDescription(
        "Invokes the assistant to generate a drafted response from case data and persists it directly as a saved draft.")]
    [ProducesResponseType(typeof(ResponseDraft), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    [ProducesResponseType(StatusCodes.Status502BadGateway)]
    [ProducesResponseType(StatusCodes.Status504GatewayTimeout)]
    public async Task<IActionResult> GenerateAndSave(int caseId, CancellationToken cancellationToken)
    {
        var work = await _database.Cases.FindAsync(new object[] { caseId }, cancellationToken);
        if (work is null)
        {
            return NotFound();
        }

        if (work.ArchivedAt is not null)
        {
            return ArchivedReadOnlyConflict();
        }

        var generated = await _assistant.DraftResponseAsync(caseId, cancellationToken);
        if (generated is null)
        {
            return NotFound();
        }

        var source = generated.Source == "mock"
            ? ResponseDraftSource.Mock
            : ResponseDraftSource.Ai;

        var draft = new ResponseDraft
        {
            CaseId = caseId,
            Content = generated.DraftText.Trim(),
            Source = source,
            Status = ResponseDraftStatus.Draft,
            CreatedBy = CurrentActorName(),
            CreatedAt = UtcNow(),
            Version = 1,
        };

        _database.ResponseDrafts.Add(draft);
        await _database.SaveChangesAsync(cancellationToken);

        _activity.Record(
            caseId,
            CaseActivityEventType.DraftCreated,
            $"Response draft created ({draft.Source})",
            CurrentActorName());
        await _database.SaveChangesAsync(cancellationToken);

        return CreatedAtAction(
            nameof(GetById),
            new { caseId, draftId = draft.Id },
            draft);
    }

    [HttpPut("{draftId:int}")]
    [EndpointSummary("Update response draft content")]
    [EndpointDescription(
        "Edits a draft's content. Requires expectedVersion for optimistic concurrency conflict prevention. " +
        "If the draft was previously Approved, editing it reverts status to Draft and clears approvedBy/approvedAt.")]
    [ProducesResponseType(typeof(ResponseDraft), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Update(
        int caseId,
        int draftId,
        UpdateResponseDraftRequest request,
        CancellationToken cancellationToken)
    {
        var work = await _database.Cases.FindAsync(new object[] { caseId }, cancellationToken);
        if (work is null)
        {
            return NotFound();
        }

        if (work.ArchivedAt is not null)
        {
            return ArchivedReadOnlyConflict();
        }

        var draft = await _database.ResponseDrafts
            .FirstOrDefaultAsync(d => d.Id == draftId && d.CaseId == caseId, cancellationToken);

        if (draft is null)
        {
            return NotFound();
        }

        if (request.ExpectedVersion != draft.Version)
        {
            return Conflict(new ProblemDetails
            {
                Title = "Conflicting update",
                Detail = "This draft was modified by another user or in another tab. Please refresh to see the latest version.",
                Status = StatusCodes.Status409Conflict,
                Extensions =
                {
                    ["currentVersion"] = draft.Version,
                    ["currentContent"] = draft.Content,
                    ["code"] = "DraftConcurrencyConflict",
                },
            });
        }

        ValidateDraftContent(request.Content);
        if (!ModelState.IsValid)
        {
            return ValidationProblem(ModelState);
        }

        var trimmed = request.Content.Trim();
        var wasApproved = draft.Status == ResponseDraftStatus.Approved;

        draft.Content = trimmed;
        draft.Version += 1;
        draft.UpdatedAt = UtcNow();

        // Editing approved text returns it to Draft and clears approval
        if (wasApproved)
        {
            draft.Status = ResponseDraftStatus.Draft;
            draft.ApprovedBy = null;
            draft.ApprovedAt = null;
        }

        await _database.SaveChangesAsync(cancellationToken);

        _activity.Record(
            caseId,
            CaseActivityEventType.DraftUpdated,
            $"Response draft #{draft.Id} edited",
            CurrentActorName());
        await _database.SaveChangesAsync(cancellationToken);

        return Ok(draft);
    }

    [HttpPost("{draftId:int}/approve")]
    [EndpointSummary("Approve a response draft")]
    [EndpointDescription(
        "Approves a draft. Requires expectedVersion and matching approvedContent to ensure approval applies " +
        "strictly to the exact saved text. Approval never sends an external message.")]
    [ProducesResponseType(typeof(ResponseDraft), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Approve(
        int caseId,
        int draftId,
        ApproveResponseDraftRequest request,
        CancellationToken cancellationToken)
    {
        var work = await _database.Cases.FindAsync(new object[] { caseId }, cancellationToken);
        if (work is null)
        {
            return NotFound();
        }

        if (work.ArchivedAt is not null)
        {
            return ArchivedReadOnlyConflict();
        }

        var draft = await _database.ResponseDrafts
            .FirstOrDefaultAsync(d => d.Id == draftId && d.CaseId == caseId, cancellationToken);

        if (draft is null)
        {
            return NotFound();
        }

        if (request.ExpectedVersion != draft.Version)
        {
            return Conflict(new ProblemDetails
            {
                Title = "Conflicting update",
                Detail = "This draft was modified by another user or in another tab. Please refresh to see the latest version.",
                Status = StatusCodes.Status409Conflict,
                Extensions =
                {
                    ["currentVersion"] = draft.Version,
                    ["currentContent"] = draft.Content,
                    ["code"] = "DraftConcurrencyConflict",
                },
            });
        }

        // Approval applies strictly to the exact saved text
        if (!string.Equals(request.ApprovedContent.Trim(), draft.Content.Trim(), StringComparison.Ordinal))
        {
            ModelState.AddModelError(
                nameof(request.ApprovedContent),
                "Approval applies only to the exact saved text. Save your edits before approving.");
            return ValidationProblem(ModelState);
        }

        if (draft.Status != ResponseDraftStatus.Approved)
        {
            draft.Status = ResponseDraftStatus.Approved;
            draft.ApprovedBy = CurrentActorName();
            draft.ApprovedAt = UtcNow();
            draft.Version += 1;
            await _database.SaveChangesAsync(cancellationToken);

            _activity.Record(
                caseId,
                CaseActivityEventType.DraftApproved,
                $"Response draft #{draft.Id} approved",
                CurrentActorName());
            await _database.SaveChangesAsync(cancellationToken);
        }

        return Ok(draft);
    }

    [HttpDelete("{draftId:int}")]
    [EndpointSummary("Delete a response draft")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Delete(int caseId, int draftId, CancellationToken cancellationToken)
    {
        var work = await _database.Cases.FindAsync(new object[] { caseId }, cancellationToken);
        if (work is null)
        {
            return NotFound();
        }

        if (work.ArchivedAt is not null)
        {
            return ArchivedReadOnlyConflict();
        }

        var draft = await _database.ResponseDrafts
            .FirstOrDefaultAsync(d => d.Id == draftId && d.CaseId == caseId, cancellationToken);

        if (draft is null)
        {
            return NotFound();
        }

        _database.ResponseDrafts.Remove(draft);
        await _database.SaveChangesAsync(cancellationToken);

        return NoContent();
    }

    private void ValidateDraftContent(string? content)
    {
        if (string.IsNullOrWhiteSpace(content))
        {
            ModelState.AddModelError(nameof(CreateResponseDraftRequest.Content), "Draft content is required.");
        }
        else if (content.Trim().Length > ResponseDraft.MaxContentLength)
        {
            ModelState.AddModelError(
                nameof(CreateResponseDraftRequest.Content),
                $"Draft content must be at most {ResponseDraft.MaxContentLength} characters.");
        }
    }

    private string CurrentActorName()
    {
        var name = User.Identity?.Name?.Trim();
        return string.IsNullOrEmpty(name) ? "Operator" : name;
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
}
