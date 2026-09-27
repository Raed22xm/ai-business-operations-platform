namespace AiBusiness.Api.Services;

public interface IOpenAiClient
{
    bool IsConfigured { get; }

    string Model { get; }

    Task<OpenAiCompletionResult> CompleteAsync(
        OpenAiCompletionRequest request,
        CancellationToken cancellationToken = default);
}

public sealed record OpenAiCompletionRequest(
    string SystemPrompt,
    string UserPrompt,
    string Purpose);

public sealed record OpenAiCompletionResult(
    string Text,
    string Model,
    bool UsedMock);
