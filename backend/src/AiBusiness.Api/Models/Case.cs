namespace AiBusiness.Api.Models;

public class Case
{
    public int Id { get; set; }
    public int CustomerId { get; set; }
    public Customer? Customer { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public CaseStatus Status { get; set; } = CaseStatus.Open;
    public DateTime CreatedAt { get; set; }
}
