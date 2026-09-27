using System.Text.Json.Serialization;

namespace AiBusiness.Api.Models;

public class CustomerNote
{
    public const int MaxContentLength = 5000;

    public int Id { get; set; }
    public int CustomerId { get; set; }

    [JsonIgnore]
    public Customer? Customer { get; set; }

    /// <summary>Plain-text note body. Max 5,000 characters. Required and non-blank.</summary>
    public string Content { get; set; } = string.Empty;

    /// <summary>Authenticated display name set by the server on create. Preserved on edit.</summary>
    public string AuthorName { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; }

    /// <summary>UTC time of the last successful edit; null until the note is edited.</summary>
    public DateTime? UpdatedAt { get; set; }
}
