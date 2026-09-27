import "server-only";
import { apiFetch } from "@/lib/api";
import type {
  CreateInquiryRequest,
  CreateInquiryResponse,
  CustomerMatch,
  InquiryField,
  InquiryFormState,
  InquiryFormValues,
  ResolveCustomerResponse,
} from "@/lib/inquiries-shared";

export type {
  CreateInquiryRequest,
  CreateInquiryResponse,
  CustomerMatch,
  InquiryField,
  InquiryFormState,
  InquiryFormValues,
  ResolveCustomerResponse,
} from "@/lib/inquiries-shared";

function inquiriesUrl(): string {
  const baseUrl = process.env.API_BASE_URL?.trim();

  if (!baseUrl) {
    throw new Error(
      "Missing API_BASE_URL. Set it in frontend/.env.local, for example http://localhost:5222.",
    );
  }

  return `${baseUrl.replace(/\/$/, "")}/api/inquiries`;
}

export async function resolveCustomer(email: string): Promise<ResolveCustomerResponse> {
  const trimmed = email.trim();
  if (!trimmed) {
    return {
      queryEmail: "",
      matches: [],
      hasExactMatch: false,
      hasMultipleMatches: false,
    };
  }

  const url = `${inquiriesUrl()}/resolve-customer?email=${encodeURIComponent(trimmed)}`;
  const response = await apiFetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    return {
      queryEmail: trimmed,
      matches: [],
      hasExactMatch: false,
      hasMultipleMatches: false,
    };
  }

  const data = (await response.json()) as ResolveCustomerResponse;
  return {
    queryEmail: data.queryEmail ?? trimmed,
    matches: Array.isArray(data.matches) ? data.matches : [],
    hasExactMatch: Boolean(data.hasExactMatch),
    hasMultipleMatches: Boolean(data.hasMultipleMatches),
  };
}

export async function createInquiry(
  input: CreateInquiryRequest,
  formValues: InquiryFormValues,
): Promise<InquiryFormState> {
  let response: Response;

  try {
    response = await apiFetch(inquiriesUrl(), {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
      cache: "no-store",
    });
  } catch {
    return {
      status: "error",
      message: null,
      formError: "Could not save the inquiry. Check that the API is running.",
      fieldErrors: {},
      values: formValues,
      savedCaseId: null,
      savedCustomerId: null,
      revision: 0,
    };
  }

  if (response.status === 201) {
    const body = (await response.json()) as CreateInquiryResponse;
    return {
      status: "success",
      message: `Inquiry successfully turned into Case #${body.caseId} for ${body.customerName}.`,
      formError: null,
      fieldErrors: {},
      savedCaseId: body.caseId,
      savedCustomerId: body.customerId,
      values: formValues,
      revision: 1,
    };
  }

  if (response.status === 400) {
    const fieldErrors = await readFieldErrors(response);
    return {
      status: "error",
      message: null,
      formError: Object.keys(fieldErrors).length === 0 ? "Could not save the inquiry. Please review your input." : null,
      fieldErrors,
      values: formValues,
      savedCaseId: null,
      savedCustomerId: null,
      revision: 0,
    };
  }

  if (response.status === 409) {
    const problem = (await response.json().catch(() => null)) as Record<string, unknown> | null;
    const code = (problem?.code as string | undefined) ?? (problem?.extensions as Record<string, unknown> | undefined)?.code;
    const detail = (problem?.detail as string | undefined) ?? "A conflict occurred while creating the inquiry.";
    const matches = ((problem?.matches as CustomerMatch[] | undefined) ??
      (problem?.extensions as Record<string, unknown> | undefined)?.matches) as CustomerMatch[] | undefined;

    if (code === "CustomerMatchRequired" || Array.isArray(matches)) {
      return {
        status: "error",
        message: null,
        formError: detail,
        fieldErrors: {},
        conflictType: "CustomerMatchRequired",
        conflictMatches: Array.isArray(matches) ? matches : [],
        values: formValues,
        savedCaseId: null,
        savedCustomerId: null,
        revision: 0,
      };
    }

    if (code === "DuplicateInquiry") {
      return {
        status: "error",
        message: null,
        formError: detail,
        fieldErrors: {},
        conflictType: "DuplicateInquiry",
        values: formValues,
        savedCaseId: null,
        savedCustomerId: null,
        revision: 0,
      };
    }

    return {
      status: "error",
      message: null,
      formError: detail,
      fieldErrors: {},
      values: formValues,
      savedCaseId: null,
      savedCustomerId: null,
      revision: 0,
    };
  }

  return {
    status: "error",
    message: null,
    formError: `Could not save the inquiry (${response.status}).`,
    fieldErrors: {},
    values: formValues,
    savedCaseId: null,
    savedCustomerId: null,
    revision: 0,
  };
}

async function readFieldErrors(
  response: Response,
): Promise<Partial<Record<InquiryField, string>>> {
  const body: unknown = await response.json().catch(() => null);
  if (typeof body !== "object" || body === null || !("errors" in body)) {
    return {};
  }

  const errors = (body as Record<string, unknown>).errors;
  if (typeof errors !== "object" || errors === null) {
    return {};
  }

  const fieldErrors: Partial<Record<InquiryField, string>> = {};
  for (const [key, messages] of Object.entries(errors)) {
    const field = inquiryField(key);
    const message = Array.isArray(messages) ? messages[0] : null;
    if (field && typeof message === "string") {
      fieldErrors[field] = message;
    }
  }

  return fieldErrors;
}

function inquiryField(key: string): InquiryField | null {
  const normalized = key.toLowerCase();
  switch (normalized) {
    case "customername":
      return "customerName";
    case "customeremail":
      return "customerEmail";
    case "customerphone":
      return "customerPhone";
    case "customercompany":
      return "customerCompany";
    case "selectedcustomerid":
      return "selectedCustomerId";
    case "title":
      return "title";
    case "description":
      return "description";
    default:
      return null;
  }
}
