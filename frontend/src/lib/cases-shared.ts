export type CaseStatus = "Open" | "InProgress" | "Closed";

export type CaseArchiveFilter = "active" | "archived" | "all";

export type CustomerCase = {
  id: number;
  customerId: number;
  title: string;
  description: string | null;
  status: CaseStatus;
  createdAt: string;
  archivedAt: string | null;
};

export type CaseListFilters = {
  customerId: number | null;
  status: CaseStatus | null;
  search: string | null;
  archive: CaseArchiveFilter | null;
  fromDate?: string | null;
  toDate?: string | null;
  page: number | null;
};

export function casesPageHref(
  customerId: number | null,
  status: CaseStatus | null,
  search: string | null = null,
  page: number | null = null,
  archive: CaseArchiveFilter | null = null,
  fromDate: string | null = null,
  toDate: string | null = null,
): string {
  const params = new URLSearchParams();
  if (customerId !== null) {
    params.set("customerId", String(customerId));
  }
  if (status !== null) {
    params.set("status", status);
  }
  const trimmed = search?.trim() ?? "";
  if (trimmed !== "") {
    params.set("search", trimmed);
  }
  if (archive && archive !== "active") {
    params.set("archive", archive);
  }
  const from = fromDate?.trim() ?? "";
  if (from !== "") {
    params.set("fromDate", from);
  }
  const to = toDate?.trim() ?? "";
  if (to !== "") {
    params.set("toDate", to);
  }
  if (page !== null && page > 1) {
    params.set("page", String(page));
  }

  const query = params.toString();
  return query === "" ? "/cases" : `/cases?${query}`;
}

export function casesExportHref(
  customerId: number | null,
  status: CaseStatus | null,
  search: string | null = null,
  archive: CaseArchiveFilter | null = null,
  fromDate: string | null = null,
  toDate: string | null = null,
): string {
  const params = new URLSearchParams();
  if (customerId !== null) {
    params.set("customerId", String(customerId));
  }
  if (status !== null) {
    params.set("status", status);
  }
  const trimmed = search?.trim() ?? "";
  if (trimmed !== "") {
    params.set("search", trimmed);
  }
  if (archive && archive !== "active") {
    params.set("archive", archive);
  }
  const from = fromDate?.trim() ?? "";
  if (from !== "") {
    params.set("fromDate", from);
  }
  const to = toDate?.trim() ?? "";
  if (to !== "") {
    params.set("toDate", to);
  }

  const query = params.toString();
  return query === "" ? "/cases/export" : `/cases/export?${query}`;
}

export function caseDetailsHref(id: number, filters?: Partial<CaseListFilters>): string {
  const params = new URLSearchParams();
  if (filters?.customerId != null) {
    params.set("customerId", String(filters.customerId));
  }
  if (filters?.status) {
    params.set("status", filters.status);
  }
  const trimmed = filters?.search?.trim() ?? "";
  if (trimmed !== "") {
    params.set("search", trimmed);
  }
  if (filters?.archive && filters.archive !== "active") {
    params.set("archive", filters.archive);
  }
  const from = filters?.fromDate?.trim() ?? "";
  if (from !== "") {
    params.set("fromDate", from);
  }
  const to = filters?.toDate?.trim() ?? "";
  if (to !== "") {
    params.set("toDate", to);
  }
  if (filters?.page != null && filters.page > 1) {
    params.set("page", String(filters.page));
  }

  const query = params.toString();
  return query === "" ? `/cases/${id}` : `/cases/${id}?${query}`;
}

export function caseStatusLabel(status: CaseStatus): string {
  if (status === "InProgress") {
    return "In progress";
  }

  return status;
}

export function isCaseArchived(work: Pick<CustomerCase, "archivedAt">): boolean {
  return work.archivedAt != null && work.archivedAt !== "";
}

export function isCaseArchiveFilter(value: string | null | undefined): value is CaseArchiveFilter {
  return value === "active" || value === "archived" || value === "all";
}

/** Returns null when the case can be archived; otherwise a user-facing reason. */
export function caseArchiveBlockedReason(
  work: Pick<CustomerCase, "status" | "archivedAt">,
  hasIncompleteTasks: boolean,
): string | null {
  if (isCaseArchived(work)) {
    return "This case is already archived.";
  }
  if (work.status !== "Closed") {
    return "Only closed cases can be archived.";
  }
  if (hasIncompleteTasks) {
    return "Archive requires every task on the case to be Done.";
  }
  return null;
}

export function caseArchiveFilterLabel(filter: CaseArchiveFilter): string {
  if (filter === "archived") {
    return "Archived";
  }
  if (filter === "all") {
    return "All";
  }
  return "Active";
}

export function formatCaseCreatedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  return `${date.getUTCDate()} ${months[date.getUTCMonth()]} ${date.getUTCFullYear()}, ${String(date.getUTCHours()).padStart(2, "0")}:${String(date.getUTCMinutes()).padStart(2, "0")} UTC`;
}
