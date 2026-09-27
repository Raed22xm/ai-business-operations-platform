using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using AiBusiness.Api.Options;
using Microsoft.Extensions.Options;

namespace AiBusiness.Api.Services;

public sealed class OpenAiHttpClient : IOpenAiClient
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
    };

    private readonly HttpClient _http;
    private readonly OpenAiOptions _options;

    public OpenAiHttpClient(HttpClient http, IOptions<OpenAiOptions> options)
    {
        _http = http;
        _options = options.Value;
    }

    public bool IsConfigured => !string.IsNullOrWhiteSpace(_options.ApiKey);

    public string Model =>
        string.IsNullOrWhiteSpace(_options.Model) ? "gpt-4o-mini" : _options.Model.Trim();

    public async Task<OpenAiCompletionResult> CompleteAsync(
        OpenAiCompletionRequest request,
        CancellationToken cancellationToken = default)
    {
        if (!IsConfigured)
        {
            throw new InvalidOperationException("OpenAI API key is not configured.");
        }

        var payload = new ChatCompletionRequest
        {
            Model = Model,
            Temperature = 0.2,
            Messages =
            [
                new ChatMessage { Role = "system", Content = request.SystemPrompt },
                new ChatMessage { Role = "user", Content = request.UserPrompt },
            ],
        };

        using var message = new HttpRequestMessage(HttpMethod.Post, "chat/completions")
        {
            Content = JsonContent.Create(payload, options: JsonOptions),
        };
        message.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _options.ApiKey!.Trim());

        HttpResponseMessage response;
        try
        {
            response = await _http.SendAsync(message, cancellationToken);
        }
        catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            throw new TimeoutException("The OpenAI request timed out.");
        }

        using (response)
        {
            if (!response.IsSuccessStatusCode)
            {
                // Do not include response body in thrown messages that might reach logs with secrets.
                throw new HttpRequestException(
                    $"OpenAI request failed with status {(int)response.StatusCode}.");
            }

            await using var stream = await response.Content.ReadAsStreamAsync(cancellationToken);
            var body = await JsonSerializer.DeserializeAsync<ChatCompletionResponse>(
                stream,
                JsonOptions,
                cancellationToken);

            var text = body?.Choices?.FirstOrDefault()?.Message?.Content?.Trim();
            if (string.IsNullOrWhiteSpace(text))
            {
                throw new HttpRequestException("OpenAI returned an empty completion.");
            }

            return new OpenAiCompletionResult(text, Model, UsedMock: false);
        }
    }

    private sealed class ChatCompletionRequest
    {
        public string Model { get; set; } = "";
        public double Temperature { get; set; }
        public ChatMessage[] Messages { get; set; } = [];
    }

    private sealed class ChatMessage
    {
        public string Role { get; set; } = "";
        public string Content { get; set; } = "";
    }

    private sealed class ChatCompletionResponse
    {
        public ChatChoice[]? Choices { get; set; }
    }

    private sealed class ChatChoice
    {
        public ChatMessage? Message { get; set; }
    }
}
