namespace AiBusiness.Api.Services;

/// <summary>
/// Deterministic stand-in used when OpenAI:ApiKey is not configured.
/// </summary>
public sealed class MockOpenAiClient : IOpenAiClient
{
    private readonly string _model;

    public MockOpenAiClient(string model = "gpt-4o-mini")
    {
        _model = string.IsNullOrWhiteSpace(model) ? "gpt-4o-mini" : model.Trim();
    }

    public bool IsConfigured => false;

    public string Model => _model;

    public Task<OpenAiCompletionResult> CompleteAsync(
        OpenAiCompletionRequest request,
        CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();

        var text = request.Purpose switch
        {
            "summary" =>
                "Review outstanding tasks with the customer and confirm the next concrete step. (Mock suggestion — configure OpenAI:ApiKey to use a live model.)",
            "draft" =>
                "Hello,\n\nThank you for contacting us about this case. Based on the saved details, here is a draft reply for your review.\n\nPlease let us know if you have any questions.\n\n(Mock draft — configure OpenAI:ApiKey to use a live model.)",
            _ => "Mock response.",
        };

        return Task.FromResult(new OpenAiCompletionResult(text, _model, UsedMock: true));
    }
}
