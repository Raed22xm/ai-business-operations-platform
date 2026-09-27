namespace AiBusiness.Api.Models;

/// <summary>
/// Task priority. <see cref="Normal"/> is 0 so omitted JSON defaults to Normal.
/// </summary>
public enum CaseTaskPriority
{
    Normal = 0,
    Low = 1,
    High = 2,
}
