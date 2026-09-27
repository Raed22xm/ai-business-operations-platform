using AiBusiness.Api.Models;
using AiBusiness.Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace AiBusiness.Api.Controllers;

[ApiController]
[Route("api/assistant")]
public sealed class AssistantController : ControllerBase
{
    private readonly CaseAssistantService _assistant;

    public AssistantController(CaseAssistantService assistant)
    {
        _assistant = assistant;
    }

    [HttpPost("cases/{caseId:int}/summary")]
    [ProducesResponseType(typeof(CaseSummaryResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status502BadGateway)]
    [ProducesResponseType(StatusCodes.Status504GatewayTimeout)]
    public async Task<IActionResult> SummarizeCase(int caseId, CancellationToken cancellationToken)
    {
        try
        {
            var summary = await _assistant.SummarizeAsync(caseId, cancellationToken);
            if (summary is null)
            {
                return NotFound();
            }

            return Ok(summary);
        }
        catch (TimeoutException exception)
        {
            return Problem(
                detail: exception.Message,
                statusCode: StatusCodes.Status504GatewayTimeout,
                title: "Provider timeout");
        }
        catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            return Problem(
                detail: "The OpenAI request timed out.",
                statusCode: StatusCodes.Status504GatewayTimeout,
                title: "Provider timeout");
        }
        catch (HttpRequestException exception)
        {
            return Problem(
                detail: exception.Message,
                statusCode: StatusCodes.Status502BadGateway,
                title: "Provider failure");
        }
        catch (InvalidOperationException exception)
        {
            return Problem(
                detail: exception.Message,
                statusCode: StatusCodes.Status502BadGateway,
                title: "Provider failure");
        }
    }

    [HttpPost("cases/{caseId:int}/draft-response")]
    [ProducesResponseType(typeof(DraftResponseResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status502BadGateway)]
    [ProducesResponseType(StatusCodes.Status504GatewayTimeout)]
    public async Task<IActionResult> DraftResponse(int caseId, CancellationToken cancellationToken)
    {
        try
        {
            var draft = await _assistant.DraftResponseAsync(caseId, cancellationToken);
            if (draft is null)
            {
                return NotFound();
            }

            return Ok(draft);
        }
        catch (TimeoutException exception)
        {
            return Problem(
                detail: exception.Message,
                statusCode: StatusCodes.Status504GatewayTimeout,
                title: "Provider timeout");
        }
        catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            return Problem(
                detail: "The OpenAI request timed out.",
                statusCode: StatusCodes.Status504GatewayTimeout,
                title: "Provider timeout");
        }
        catch (HttpRequestException exception)
        {
            return Problem(
                detail: exception.Message,
                statusCode: StatusCodes.Status502BadGateway,
                title: "Provider failure");
        }
        catch (InvalidOperationException exception)
        {
            return Problem(
                detail: exception.Message,
                statusCode: StatusCodes.Status502BadGateway,
                title: "Provider failure");
        }
    }
}
