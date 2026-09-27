using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;

namespace AiBusiness.Api.Models;

public class CreateResponseDraftRequest
{
    [Required]
    [MaxLength(ResponseDraft.MaxContentLength)]
    public string Content { get; set; } = string.Empty;

    [JsonConverter(typeof(JsonStringEnumConverter))]
    public ResponseDraftSource Source { get; set; } = ResponseDraftSource.Ai;
}

public class UpdateResponseDraftRequest
{
    [Required]
    [MaxLength(ResponseDraft.MaxContentLength)]
    public string Content { get; set; } = string.Empty;

    public int ExpectedVersion { get; set; }
}

public class ApproveResponseDraftRequest
{
    [Required]
    public string ApprovedContent { get; set; } = string.Empty;

    public int ExpectedVersion { get; set; }
}
