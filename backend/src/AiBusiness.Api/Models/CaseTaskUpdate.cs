namespace AiBusiness.Api.Models;

public class CaseTaskUpdate
{
    public int Id { get; set; }
    public int CaseId { get; set; }
    public string? Title { get; set; }
    public string? Description { get; set; }
    public DateOnly? DueDate { get; set; }
    public string? Status { get; set; }
    public DateTime CreatedAt { get; set; }
}
