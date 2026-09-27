namespace AiBusiness.Api.Models;

public class CaseUpdate
{
    public int Id { get; set; }
    public int CustomerId { get; set; }
    public string? Title { get; set; }
    public string? Description { get; set; }
    public string? Status { get; set; }
    public DateTime CreatedAt { get; set; }
}
