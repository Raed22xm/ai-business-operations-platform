using AiBusiness.Api.Models;

namespace AiBusiness.Api.Services;

/// <summary>
/// Rules for archiving closed cases. Archiving is manual only.
/// </summary>
public static class CaseArchiveRules
{
    public static bool IsArchived(DateTime? archivedAt) => archivedAt is not null;

    public static bool CanArchive(CaseStatus status, bool hasIncompleteTasks, bool alreadyArchived)
    {
        if (alreadyArchived)
        {
            return false;
        }

        if (status != CaseStatus.Closed)
        {
            return false;
        }

        return !hasIncompleteTasks;
    }

    public static string ArchiveBlockedReason(CaseStatus status, bool hasIncompleteTasks, bool alreadyArchived)
    {
        if (alreadyArchived)
        {
            return "This case is already archived.";
        }

        if (status != CaseStatus.Closed)
        {
            return "Only closed cases can be archived.";
        }

        if (hasIncompleteTasks)
        {
            return "Archive requires every task on the case to be Done.";
        }

        return "This case cannot be archived.";
    }
}
