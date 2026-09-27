import "server-only";
import { apiFetch } from "@/lib/api";

export type CaseActivityEventType =
  | "CaseCreated"
  | "CaseEdited"
  | "CaseStatusChanged"
  | "CaseArchived"
  | "CaseRestored"
  | "TaskCreated"
  | "TaskUpdated"
  | "TaskCompleted"
  | "TaskDeleted";

export type CaseActivity = {
  id: number;
  caseId: number;
  eventType: CaseActivityEventType;
  description: string;
  occurredAt: string;
  actorName: string | null;
};

export type PagedCaseActivity = {
  items: CaseActivity[];
  page: number;
  pageSize: number;
  totalCount: number;
};

export const CASE_ACTIVITY_PAGE_SIZE = 10;

export async function getCaseActivityPage(
  caseId: number,
  page: number = 1,
  pageSize: number = CASE_ACTIVITY_PAGE_SIZE,
): Promise<PagedCaseActivity> {
  if (!Number.isInteger(caseId) || caseId <= 0) {
    throw new Error("Invalid case id.");
  }

  const url = new URL(`${activityBaseUrl(caseId)}`);
  url.searchParams.set("page", String(page));
  url.searchParams.set("pageSize", String(pageSize));

  let response: Response;
  try {
    response = await apiFetch(url, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
  } catch {
    throw new Error("Could not load activity. Check that the API is running.");
  }

  if (response.status === 404) {
    throw new Error("That case was not found.");
  }

  if (!response.ok) {
    throw new Error(`Could not load activity (${response.status}).`);
  }

  const body: unknown = await response.json();
  if (!isPagedActivity(body)) {
    throw new Error("Activity page had an unexpected shape.");
  }

  return body;
}

function activityBaseUrl(caseId: number): string {
  const baseUrl = process.env.API_BASE_URL?.trim();
  if (!baseUrl) {
    throw new Error(
      "Missing API_BASE_URL. Set it in frontend/.env.local, for example http://localhost:5222.",
    );
  }
  return `${baseUrl.replace(/\/$/, "")}/api/cases/${caseId}/activity`;
}

function isPagedActivity(value: unknown): value is PagedCaseActivity {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const row = value as Record<string, unknown>;
  return (
    Array.isArray(row.items) &&
    row.items.every(isCaseActivity) &&
    typeof row.page === "number" &&
    typeof row.pageSize === "number" &&
    typeof row.totalCount === "number"
  );
}

function isCaseActivity(value: unknown): value is CaseActivity {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const row = value as Record<string, unknown>;
  return (
    typeof row.id === "number" &&
    typeof row.caseId === "number" &&
    typeof row.eventType === "string" &&
    typeof row.description === "string" &&
    typeof row.occurredAt === "string" &&
    (row.actorName === null || typeof row.actorName === "string")
  );
}
