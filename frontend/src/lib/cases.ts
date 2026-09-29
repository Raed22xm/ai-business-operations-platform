import "server-only";
import { apiFetch } from "@/lib/api";
import type { CaseField, CaseFormState, DeleteCaseState } from "@/lib/case-form-state";
import type { CaseStatus, CaseArchiveFilter, CustomerCase } from "@/lib/cases-shared";

export type {
  CaseArchiveFilter,
  CaseListFilters,
  CaseStatus,
  CustomerCase,
} from "@/lib/cases-shared";
export {
  caseArchiveBlockedReason,
  caseDetailsHref,
  caseStatusLabel,
  casesExportHref,
  casesPageHref,
  formatCaseCreatedAt,
  isCaseArchived,
  isCaseArchiveFilter,
} from "@/lib/cases-shared";

export type NewCase = {
  customerId: number;
  title: string;
  description: string | null;
};

export type CaseChanges = {
  title: string;
  description: string | null;
  status: CaseStatus;
};

export async function createCase(input: NewCase): Promise<CaseFormState> {
  let response: Response;

  try {
    response = await apiFetch(casesUrl(), {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
      cache: "no-store",
    });
  } catch {
    return caseError("Could not save the case. Check that the API is running.");
  }

  if (response.status === 201) {
    const body: unknown = await response.json();
    if (!isCustomerCase(body)) {
      return caseError("The API returned an unexpected case.");
    }

    return {
      status: "success",
      message: `${body.title} was added.`,
      formError: null,
      fieldErrors: {},
      revision: 0,
      customerId: body.customerId,
    };
  }

  if (response.status === 400) {
    const fieldErrors = await readFieldErrors(response);
    return {
      status: "error",
      message: null,
      formError: Object.keys(fieldErrors).length === 0 ? "Could not save the case." : null,
      fieldErrors,
      revision: 0,
      customerId: null,
    };
  }

  return caseError(`Could not save the case (${response.status}).`);
}

export async function updateCase(id: number, input: CaseChanges): Promise<CaseFormState> {
  let response: Response;

  try {
    response = await apiFetch(`${casesUrl()}/${id}`, {
      method: "PUT",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
      cache: "no-store",
    });
  } catch {
    return caseError("Could not save the case. Check that the API is running.");
  }

  if (response.status === 200) {
    const body: unknown = await response.json();
    if (!isCustomerCase(body)) {
      return caseError("The API returned an unexpected case.");
    }

    return {
      status: "success",
      message: `${body.title} was updated.`,
      formError: null,
      fieldErrors: {},
      revision: 0,
      customerId: body.customerId,
    };
  }

  if (response.status === 400) {
    const fieldErrors = await readFieldErrors(response);
    return {
      status: "error",
      message: null,
      formError: Object.keys(fieldErrors).length === 0 ? "Could not save the case." : null,
      fieldErrors,
      revision: 0,
      customerId: null,
    };
  }

  if (response.status === 404) {
    return caseError("That case was not found.");
  }

  if (response.status === 409) {
    return caseError(await readArchiveConflictDetail(response, "This case cannot be updated."));
  }

  return caseError(`Could not save the case (${response.status}).`);
}

export async function deleteCase(id: number, title: string): Promise<DeleteCaseState> {
  let response: Response;

  try {
    response = await apiFetch(`${casesUrl()}/${id}`, {
      method: "DELETE",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
  } catch {
    return deleteCaseError(id, "Could not delete the case. Check that the API is running.");
  }

  if (response.status === 204) {
    return {
      status: "success",
      message: `${title} was deleted.`,
      formError: null,
      caseId: id,
    };
  }

  if (response.status === 404) {
    return deleteCaseError(id, "That case was not found.");
  }

  if (response.status === 409) {
    return deleteCaseError(id, await readCaseConflictDetail(response));
  }

  return deleteCaseError(id, `Could not delete the case (${response.status}).`);
}

export async function archiveCase(id: number, title: string): Promise<DeleteCaseState> {
  let response: Response;
  try {
    response = await apiFetch(`${casesUrl()}/${id}/archive`, {
      method: "POST",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
  } catch {
    return deleteCaseError(id, "Could not archive the case. Check that the API is running.");
  }

  if (response.ok) {
    return {
      status: "success",
      message: `${title} was archived.`,
      formError: null,
      caseId: id,
    };
  }

  if (response.status === 404) {
    return deleteCaseError(id, "That case was not found.");
  }

  if (response.status === 409) {
    return deleteCaseError(id, await readArchiveConflictDetail(response));
  }

  return deleteCaseError(id, `Could not archive the case (${response.status}).`);
}

export async function restoreCase(id: number, title: string): Promise<DeleteCaseState> {
  let response: Response;
  try {
    response = await apiFetch(`${casesUrl()}/${id}/restore`, {
      method: "POST",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
  } catch {
    return deleteCaseError(id, "Could not restore the case. Check that the API is running.");
  }

  if (response.ok) {
    return {
      status: "success",
      message: `${title} was restored.`,
      formError: null,
      caseId: id,
    };
  }

  if (response.status === 404) {
    return deleteCaseError(id, "That case was not found.");
  }

  if (response.status === 409) {
    return deleteCaseError(id, await readArchiveConflictDetail(response, "This case is not archived."));
  }

  return deleteCaseError(id, `Could not restore the case (${response.status}).`);
}

async function readArchiveConflictDetail(
  response: Response,
  fallback = "This case cannot be archived.",
): Promise<string> {
  try {
    const body = (await response.json()) as { detail?: unknown };
    return typeof body.detail === "string" && body.detail.trim() !== ""
      ? body.detail.trim()
      : fallback;
  } catch {
    return fallback;
  }
}

async function readCaseConflictDetail(response: Response): Promise<string> {
  const fallback = "This case has tasks and cannot be deleted.";
  try {
    const body = (await response.json()) as { detail?: unknown };
    return typeof body.detail === "string" && body.detail.trim() !== ""
      ? body.detail.trim()
      : fallback;
  } catch {
    return fallback;
  }
}

export async function getCase(id: number): Promise<CustomerCase | null> {
  if (!Number.isInteger(id) || id <= 0) {
    return null;
  }

  let response: Response;
  try {
    response = await apiFetch(`${casesUrl()}/${id}`, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
  } catch {
    throw new Error("Could not load the case. Check that the API is running.");
  }

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`Could not load the case (${response.status}).`);
  }

  const body: unknown = await response.json();
  if (!isCustomerCase(body)) {
    throw new Error("Case detail had an unexpected shape.");
  }

  return body;
}

export type PagedCases = {
  items: CustomerCase[];
  page: number;
  pageSize: number;
  totalCount: number;
};

export const CASES_PAGE_SIZE = 20;

export async function getCases(options?: {
  customerId?: number;
  status?: CaseStatus;
  search?: string;
  archive?: CaseArchiveFilter;
}): Promise<CustomerCase[]> {
  const url = new URL(casesUrl());
  if (options?.customerId !== undefined) {
    url.searchParams.set("customerId", String(options.customerId));
  }
  if (options?.status !== undefined) {
    url.searchParams.set("status", options.status);
  }
  const search = options?.search?.trim();
  if (search) {
    url.searchParams.set("search", search);
  }
  if (options?.archive) {
    url.searchParams.set("archive", options.archive);
  }

  const response = await apiFetch(url, { cache: "no-store" });

  if (!response.ok) {
    throw new Error(`Could not load cases (${response.status}).`);
  }

  const body: unknown = await response.json();

  if (!Array.isArray(body) || !body.every(isCustomerCase)) {
    throw new Error("Case list had an unexpected shape.");
  }

  return body;
}

export async function getCasesPage(options?: {
  customerId?: number;
  status?: CaseStatus;
  search?: string;
  archive?: CaseArchiveFilter;
  fromDate?: string;
  toDate?: string;
  page?: number;
  pageSize?: number;
}): Promise<PagedCases> {
  const url = new URL(casesUrl());
  if (options?.customerId !== undefined) {
    url.searchParams.set("customerId", String(options.customerId));
  }
  if (options?.status !== undefined) {
    url.searchParams.set("status", options.status);
  }
  const search = options?.search?.trim();
  if (search) {
    url.searchParams.set("search", search);
  }
  if (options?.archive) {
    url.searchParams.set("archive", options.archive);
  }
  const fromDate = options?.fromDate?.trim();
  if (fromDate) {
    url.searchParams.set("fromDate", fromDate);
  }
  const toDate = options?.toDate?.trim();
  if (toDate) {
    url.searchParams.set("toDate", toDate);
  }
  url.searchParams.set("page", String(options?.page ?? 1));
  url.searchParams.set("pageSize", String(options?.pageSize ?? CASES_PAGE_SIZE));

  const response = await apiFetch(url, { cache: "no-store" });

  if (!response.ok) {
    throw new Error(`Could not load cases (${response.status}).`);
  }

  const body: unknown = await response.json();
  if (!isPagedCases(body)) {
    throw new Error("Case page had an unexpected shape.");
  }

  return body;
}

function isPagedCases(value: unknown): value is PagedCases {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const row = value as Record<string, unknown>;
  return (
    Array.isArray(row.items) &&
    row.items.every(isCustomerCase) &&
    typeof row.page === "number" &&
    Number.isInteger(row.page) &&
    row.page >= 1 &&
    typeof row.pageSize === "number" &&
    Number.isInteger(row.pageSize) &&
    row.pageSize >= 1 &&
    typeof row.totalCount === "number" &&
    Number.isInteger(row.totalCount) &&
    row.totalCount >= 0
  );
}

function casesUrl(): string {
  const baseUrl = process.env.API_BASE_URL?.trim();

  if (!baseUrl) {
    throw new Error(
      "Missing API_BASE_URL. Set it in frontend/.env.local, for example http://localhost:5222.",
    );
  }

  return `${baseUrl.replace(/\/$/, "")}/api/cases`;
}

function isCustomerCase(value: unknown): value is CustomerCase {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const row = value as Record<string, unknown>;

  return (
    typeof row.id === "number" &&
    typeof row.customerId === "number" &&
    typeof row.title === "string" &&
    (row.description === null || typeof row.description === "string") &&
    isCaseStatus(row.status) &&
    typeof row.createdAt === "string" &&
    (row.archivedAt === null || typeof row.archivedAt === "string")
  );
}

function isCaseStatus(value: unknown): value is CaseStatus {
  return value === "Open" || value === "InProgress" || value === "Closed";
}

function caseError(formError: string): CaseFormState {
  return {
    status: "error",
    message: null,
    formError,
    fieldErrors: {},
    revision: 0,
    customerId: null,
  };
}

function deleteCaseError(caseId: number, formError: string): DeleteCaseState {
  return {
    status: "error",
    message: null,
    formError,
    caseId,
  };
}

async function readFieldErrors(
  response: Response,
): Promise<Partial<Record<CaseField, string>>> {
  const body: unknown = await response.json().catch(() => null);
  if (typeof body !== "object" || body === null || !("errors" in body)) {
    return {};
  }

  const errors = body.errors;
  if (typeof errors !== "object" || errors === null) {
    return {};
  }

  const fieldErrors: Partial<Record<CaseField, string>> = {};
  for (const [key, messages] of Object.entries(errors)) {
    const field = caseField(key);
    const message = Array.isArray(messages) ? messages[0] : null;
    if (field && typeof message === "string") {
      fieldErrors[field] = message;
    }
  }

  return fieldErrors;
}

function caseField(key: string): CaseField | null {
  const normalized = key.toLowerCase();
  if (normalized === "customerid") {
    return "customerId";
  }
  if (normalized === "title" || normalized === "description" || normalized === "status") {
    return normalized;
  }

  return null;
}
