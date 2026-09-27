using System.Text.Json.Serialization;

namespace AiBusiness.Api.Models;

/// <summary>
/// Reusable case blueprint. Does not reference customers or due dates.
/// Creating a case from a template copies values; later template edits do not affect existing cases.
/// </summary>
public class CaseTemplate
{
    public const int MaxNameLength = 200;
    public const int MaxDescriptionLength = 5000;
    public const int MaxTaskCount = 50;
    public const int MaxTaskTitleLength = 200;

    public int Id { get; set; }

    /// <summary>Required display name. 1–200 characters after trim.</summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>Optional default case description. Max 5,000 characters.</summary>
    public string? Description { get; set; }

    public DateTime CreatedAt { get; set; }

    /// <summary>Ordered task titles for this template. Cascaded on template delete.</summary>
    public List<CaseTemplateTask> Tasks { get; set; } = [];
}

public class CaseTemplateTask
{
    public int Id { get; set; }
    public int CaseTemplateId { get; set; }

    [JsonIgnore]
    public CaseTemplate? Template { get; set; }

    /// <summary>Task title copied into a new case. 1–200 characters after trim.</summary>
    public string Title { get; set; } = string.Empty;

    /// <summary>Zero-based order within the template.</summary>
    public int SortOrder { get; set; }
}

/// <summary>Create/update body for case templates. Task titles replace the full ordered list.</summary>
public class CaseTemplateWrite
{
    public string? Name { get; set; }
    public string? Description { get; set; }
    public List<string>? TaskTitles { get; set; }
}

/// <summary>
/// Creates a case and tasks from edited template values in one transaction.
/// Values are taken from this body (not re-read from a template) so later template edits cannot affect the result.
/// </summary>
public class CreateCaseFromTemplateRequest
{
    public int CustomerId { get; set; }
    public string? Title { get; set; }
    public string? Description { get; set; }
    public List<string>? TaskTitles { get; set; }
}

public class CaseFromTemplateResult
{
    public Case Case { get; set; } = null!;
    public List<CaseTask> Tasks { get; set; } = [];
}
