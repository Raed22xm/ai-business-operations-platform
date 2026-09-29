"server-only";

import { apiFetch } from "@/lib/api";

export type CustomerActivityEventType =
  | "CaseCreated"
  | "CaseEdited"
  | "CaseStatusChanged"
  | "CaseArchived"
  | "CaseRestored"
  | "TaskCreated"
  | "TaskUpdated"
  | "TaskCompleted"
  | "TaskDeleted"
  | "DraftCreated"
  | "DraftUpdated"
  | "DraftApproved";

export type CustomerActivity = {
  id: number;
  caseId: number;
  caseTitle: string;
  eventType: CustomerActivityEventType;
  description: string;
  occurredAt: string;
  actorName: string | null;
};

export type PagedCustomerActivity = {
  items: CustomerActivity[];
  page: number;
  pageSize: number;
  totalCount: number;
};

export const CUSTOMER_ACTIVITY_PAGE_SIZE = 10;

export async function getCustomerActivityPage(
  customerId: number,
  page: number = 1,
  pageSize: number = CUSTOMER_ACTIVITY_PAGE_SIZE,
): Promise<PagedCustomerActivity> {
  if (!Number.isInteger(customerId) || customerId <= 0) {
    throw new Error("Invalid customer id.");
  }

  const url = new URL(customerActivityBaseUrl(customerId));
  url.searchParams.set("page", String(page));
  url.searchParams.set("pageSize", String(pageSize));

  let response: Response;
  try {
    response = await apiFetch(url, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
  } catch {
    throw new Error("Could not load customer activity. Check that the API is running.");
  }

  if (response.status === 404) {
    throw new Error("That customer was not found.");
  }

  if (!response.ok) {
    throw new Error(`Could not load customer activity (${response.status}).`);
  }

  const body: unknown = await response.json();
  if (!isPagedCustomerActivity(body)) {
    throw new Error("Customer activity page had an unexpected shape.");
  }

  return body;
}

function customerActivityBaseUrl(customerId: number): string {
  const baseUrl = process.env.API_BASE_URL?.trim();
  if (!baseUrl) {
    throw new Error(
      "Missing API_BASE_URL. Set it in frontend/.env.local, for example http://localhost:5222.",
    );
  }
  return `${baseUrl.replace(/\/$/, "")}/api/customers/${customerId}/activity`;
}

function isPagedCustomerActivity(value: unknown): value is PagedCustomerActivity {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const row = value as Record<string, unknown>;
  return (
    Array.isArray(row.items) &&
    row.items.every(isCustomerActivity) &&
    typeof row.page === "number" &&
    typeof row.pageSize === "number" &&
    typeof row.totalCount === "number"
  );
}

function isCustomerActivity(value: unknown): value is CustomerActivity {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const row = value as Record<string, unknown>;
  return (
    typeof row.id === "number" &&
    typeof row.caseId === "number" &&
    typeof row.caseTitle === "string" &&
    typeof row.eventType === "string" &&
    typeof row.description === "string" &&
    typeof row.occurredAt === "string" &&
    (row.actorName === null || typeof row.actorName === "string")
  );
}
