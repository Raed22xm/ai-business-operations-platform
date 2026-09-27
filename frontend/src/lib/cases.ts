import type { CaseField, CaseFormState, DeleteCaseState } from "@/lib/case-form-state";

export type CaseStatus = "Open" | "InProgress" | "Closed";

export type CustomerCase = {
  id: number;
  customerId: number;
  title: string;
  description: string | null;
  status: CaseStatus;
  createdAt: string;
};

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
    response = await fetch(casesUrl(), {
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
    response = await fetch(`${casesUrl()}/${id}`, {
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

  return caseError(`Could not save the case (${response.status}).`);
}

export async function deleteCase(id: number, title: string): Promise<DeleteCaseState> {
  let response: Response;

  try {
    response = await fetch(`${casesUrl()}/${id}`, {
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

  return deleteCaseError(id, `Could not delete the case (${response.status}).`);
}

export async function getCase(id: number): Promise<CustomerCase | null> {
  if (!Number.isInteger(id) || id <= 0) {
    return null;
  }

  let response: Response;
  try {
    response = await fetch(`${casesUrl()}/${id}`, {
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

  const response = await fetch(url, { cache: "no-store" });

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
  url.searchParams.set("page", String(options?.page ?? 1));
  url.searchParams.set("pageSize", String(options?.pageSize ?? CASES_PAGE_SIZE));

  const response = await fetch(url, { cache: "no-store" });

  if (!response.ok) {
    throw new Error(`Could not load cases (${response.status}).`);
  }

  const body: unknown = await response.json();
  if (!isPagedCases(body)) {
    throw new Error("Case page had an unexpected shape.");
  }

  return body;
}

export type CaseListFilters = {
  customerId: number | null;
  status: CaseStatus | null;
  search: string | null;
  page: number | null;
};

export function casesPageHref(
  customerId: number | null,
  status: CaseStatus | null,
  search: string | null = null,
  page: number | null = null,
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
  if (page !== null && page > 1) {
    params.set("page", String(page));
  }

  const query = params.toString();
  return query === "" ? "/cases" : `/cases?${query}`;
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
  if (filters?.page != null && filters.page > 1) {
    params.set("page", String(filters.page));
  }

  const query = params.toString();
  return query === "" ? `/cases/${id}` : `/cases/${id}?${query}`;
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

export function caseStatusLabel(status: CaseStatus): string {
  if (status === "InProgress") {
    return "In progress";
  }

  return status;
}

export function formatCaseCreatedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return `${new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(date)} UTC`;
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
    typeof row.createdAt === "string"
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
