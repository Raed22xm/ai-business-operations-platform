namespace AiBusiness.Api.Models;

public class DashboardSummary
{
    public int TotalCustomers { get; set; }
    public int TotalCases { get; set; }
    public int OpenCases { get; set; }
    public int InProgressCases { get; set; }
    public int ClosedCases { get; set; }
}
