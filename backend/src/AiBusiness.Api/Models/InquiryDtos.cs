using System.ComponentModel.DataAnnotations;

namespace AiBusiness.Api.Models;

public sealed class CustomerMatchDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string? Phone { get; set; }
    public string? Company { get; set; }
    public DateTime CreatedAt { get; set; }

    public static CustomerMatchDto From(Customer customer) => new()
    {
        Id = customer.Id,
        Name = customer.Name,
        Email = customer.Email,
        Phone = customer.Phone,
        Company = customer.Company,
        CreatedAt = customer.CreatedAt,
    };
}

public sealed class ResolveCustomerResponse
{
    public string QueryEmail { get; set; } = string.Empty;
    public IReadOnlyList<CustomerMatchDto> Matches { get; set; } = Array.Empty<CustomerMatchDto>();
    public bool HasExactMatch => Matches.Count > 0;
    public bool HasMultipleMatches => Matches.Count > 1;
}

public sealed class CreateInquiryRequest
{
    public int? SelectedCustomerId { get; set; }

    public string? CustomerName { get; set; }

    public string? CustomerEmail { get; set; }

    public string? CustomerPhone { get; set; }

    public string? CustomerCompany { get; set; }

    public bool ConfirmCreateNew { get; set; }

    [Required]
    [StringLength(200, MinimumLength = 1)]
    public string Title { get; set; } = string.Empty;

    public string? Description { get; set; }

    public string? SubmissionToken { get; set; }
}

public sealed class CreateInquiryResponse
{
    public int CaseId { get; set; }
    public int CustomerId { get; set; }
    public string CustomerName { get; set; } = string.Empty;
    public string CaseTitle { get; set; } = string.Empty;
    public bool IsNewCustomer { get; set; }
    public DateTime CreatedAt { get; set; }
}
