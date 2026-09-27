import "server-only";
import { apiFetch } from "@/lib/api";
import type {
  CustomerNoteField,
  CustomerNoteFormState,
  DeleteCustomerNoteState,
} from "@/lib/customer-note-form-state";
import type { CustomerNote, PagedCustomerNotes } from "@/lib/customer-notes-shared";
import { CUSTOMER_NOTES_PAGE_SIZE } from "@/lib/customer-notes-shared";

export type { CustomerNote, PagedCustomerNotes } from "@/lib/customer-notes-shared";
export {
  CUSTOMER_NOTE_MAX_LENGTH,
  CUSTOMER_NOTES_PAGE_SIZE,
  formatNoteTimestamp,
  notePreviewLabel,
} from "@/lib/customer-notes-shared";

export async function getCustomerNotesPage(
  customerId: number,
  page: number = 1,
  pageSize: number = CUSTOMER_NOTES_PAGE_SIZE,
): Promise<PagedCustomerNotes> {
  if (!Number.isInteger(customerId) || customerId <= 0) {
    throw new Error("Invalid customer id.");
  }

  const url = new URL(notesUrl(customerId));
  url.searchParams.set("page", String(page));
  url.searchParams.set("pageSize", String(pageSize));

  let response: Response;
  try {
    response = await apiFetch(url, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
  } catch {
    throw new Error("Could not load notes. Check that the API is running.");
  }

  if (response.status === 404) {
    throw new Error("That customer was not found.");
  }

  if (!response.ok) {
    throw new Error(`Could not load notes (${response.status}).`);
  }

  const body: unknown = await response.json();
  if (!isPagedNotes(body)) {
    throw new Error("Notes page had an unexpected shape.");
  }

  return body;
}

export async function createCustomerNote(
  customerId: number,
  content: string,
): Promise<CustomerNoteFormState> {
  let response: Response;
  try {
    response = await apiFetch(notesUrl(customerId), {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ content }),
      cache: "no-store",
    });
  } catch {
    return noteError("Could not save the note. Check that the API is running.");
  }

  if (response.status === 201) {
    const body: unknown = await response.json();
    if (!isCustomerNote(body)) {
      return noteError("The API returned an unexpected note.");
    }

    return {
      status: "success",
      message: "Note was added.",
      formError: null,
      fieldErrors: {},
      revision: 0,
      noteId: body.id,
    };
  }

  if (response.status === 400) {
    const fieldErrors = await readFieldErrors(response);
    return {
      status: "error",
      message: null,
      formError: Object.keys(fieldErrors).length === 0 ? "Could not save the note." : null,
      fieldErrors,
      revision: 0,
      noteId: null,
    };
  }

  if (response.status === 404) {
    return noteError("That customer was not found.");
  }

  return noteError(`Could not save the note (${response.status}).`);
}

export async function updateCustomerNote(
  customerId: number,
  noteId: number,
  content: string,
): Promise<CustomerNoteFormState> {
  let response: Response;
  try {
    response = await apiFetch(`${notesUrl(customerId)}/${noteId}`, {
      method: "PUT",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ content }),
      cache: "no-store",
    });
  } catch {
    return noteError("Could not save the note. Check that the API is running.", noteId);
  }

  if (response.status === 200) {
    const body: unknown = await response.json();
    if (!isCustomerNote(body)) {
      return noteError("The API returned an unexpected note.", noteId);
    }

    return {
      status: "success",
      message: "Note was updated.",
      formError: null,
      fieldErrors: {},
      revision: 0,
      noteId: body.id,
    };
  }

  if (response.status === 400) {
    const fieldErrors = await readFieldErrors(response);
    return {
      status: "error",
      message: null,
      formError: Object.keys(fieldErrors).length === 0 ? "Could not save the note." : null,
      fieldErrors,
      revision: 0,
      noteId,
    };
  }

  if (response.status === 404) {
    return noteError("That note was not found.", noteId);
  }

  return noteError(`Could not save the note (${response.status}).`, noteId);
}

export async function deleteCustomerNote(
  customerId: number,
  noteId: number,
  label: string,
): Promise<DeleteCustomerNoteState> {
  let response: Response;
  try {
    response = await apiFetch(`${notesUrl(customerId)}/${noteId}`, {
      method: "DELETE",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
  } catch {
    return deleteError(noteId, "Could not delete the note. Check that the API is running.");
  }

  if (response.status === 204) {
    return {
      status: "success",
      message: `${label} was deleted.`,
      formError: null,
      noteId,
    };
  }

  if (response.status === 404) {
    return deleteError(noteId, "That note was not found.");
  }

  return deleteError(noteId, `Could not delete the note (${response.status}).`);
}

function notesUrl(customerId: number): string {
  const baseUrl = process.env.API_BASE_URL?.trim();
  if (!baseUrl) {
    throw new Error(
      "Missing API_BASE_URL. Set it in frontend/.env.local, for example http://localhost:5222.",
    );
  }
  return `${baseUrl.replace(/\/$/, "")}/api/customers/${customerId}/notes`;
}

function noteError(formError: string, noteId: number | null = null): CustomerNoteFormState {
  return {
    status: "error",
    message: null,
    formError,
    fieldErrors: {},
    revision: 0,
    noteId,
  };
}

function deleteError(noteId: number, formError: string): DeleteCustomerNoteState {
  return {
    status: "error",
    message: null,
    formError,
    noteId,
  };
}

function isPagedNotes(value: unknown): value is PagedCustomerNotes {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const row = value as Record<string, unknown>;
  return (
    Array.isArray(row.items) &&
    row.items.every(isCustomerNote) &&
    typeof row.page === "number" &&
    typeof row.pageSize === "number" &&
    typeof row.totalCount === "number"
  );
}

function isCustomerNote(value: unknown): value is CustomerNote {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const row = value as Record<string, unknown>;
  return (
    typeof row.id === "number" &&
    typeof row.customerId === "number" &&
    typeof row.content === "string" &&
    typeof row.authorName === "string" &&
    typeof row.createdAt === "string" &&
    (row.updatedAt === null || typeof row.updatedAt === "string")
  );
}

async function readFieldErrors(
  response: Response,
): Promise<Partial<Record<CustomerNoteField, string>>> {
  const body: unknown = await response.json().catch(() => null);
  if (typeof body !== "object" || body === null || !("errors" in body)) {
    return {};
  }

  const errors = body.errors;
  if (typeof errors !== "object" || errors === null) {
    return {};
  }

  const fieldErrors: Partial<Record<CustomerNoteField, string>> = {};
  for (const [key, messages] of Object.entries(errors)) {
    if (key.toLowerCase() !== "content") {
      continue;
    }
    const message = Array.isArray(messages) ? messages[0] : null;
    if (typeof message === "string") {
      fieldErrors.content = message;
    }
  }

  return fieldErrors;
}
