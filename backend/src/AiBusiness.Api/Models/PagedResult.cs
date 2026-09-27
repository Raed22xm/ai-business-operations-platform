namespace AiBusiness.Api.Models;

public class PagedResult<T>
{
    public required T[] Items { get; set; }
    public int Page { get; set; }
    public int PageSize { get; set; }
    public int TotalCount { get; set; }
}
