namespace AiBusiness.Api.Models;

public class TaskStatusUpdate
{
    /// <summary>
    /// Required. Must be exactly Todo, InProgress, or Done (case-sensitive).
    /// </summary>
    public string? Status { get; set; }
}
