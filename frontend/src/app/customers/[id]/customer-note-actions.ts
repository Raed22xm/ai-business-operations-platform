"use server";

import { revalidatePath } from "next/cache";
import type {
  CustomerNoteFormState,
  DeleteCustomerNoteState,
} from "@/lib/customer-note-form-state";
import {
  createCustomerNote,
  deleteCustomerNote,
  getCustomerNotesPage,
  CUSTOMER_NOTES_PAGE_SIZE,
  notePreviewLabel,
  updateCustomerNote,
  type CustomerNote,
} from "@/lib/customer-notes";

export type LoadCustomerNotesResult =
  | {
      status: "success";
      items: CustomerNote[];
      page: number;
      pageSize: number;
      totalCount: number;
      hasMore: boolean;
    }
  | { status: "error"; message: string };

export async function loadCustomerNotesAction(
  customerId: number,
  page: number = 1,
): Promise<LoadCustomerNotesResult> {
  try {
    const result = await getCustomerNotesPage(customerId, page, CUSTOMER_NOTES_PAGE_SIZE);
    const loaded = result.page * result.pageSize;
    return {
      status: "success",
      items: result.items,
      page: result.page,
      pageSize: result.pageSize,
      totalCount: result.totalCount,
      hasMore: loaded < result.totalCount,
    };
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "Could not load notes for this customer.",
    };
  }
}

export async function createCustomerNoteAction(
  customerId: number,
  previous: CustomerNoteFormState,
  formData: FormData,
): Promise<CustomerNoteFormState> {
  const content = text(formData, "content");
  const result = await createCustomerNote(customerId, content);

  if (result.status === "success") {
    revalidatePath(`/customers/${customerId}`);
  }

  return {
    ...result,
    revision: result.status === "success" ? previous.revision + 1 : previous.revision,
  };
}

export async function updateCustomerNoteAction(
  customerId: number,
  noteId: number,
  previous: CustomerNoteFormState,
  formData: FormData,
): Promise<CustomerNoteFormState> {
  const content = text(formData, "content");
  const result = await updateCustomerNote(customerId, noteId, content);

  if (result.status === "success") {
    revalidatePath(`/customers/${customerId}`);
  }

  return {
    ...result,
    revision: result.status === "success" ? previous.revision + 1 : previous.revision,
    noteId,
  };
}

export async function deleteCustomerNoteAction(
  customerId: number,
  _previous: DeleteCustomerNoteState,
  formData: FormData,
): Promise<DeleteCustomerNoteState> {
  const id = Number(formData.get("id"));
  const label = text(formData, "label").trim() || "Note";

  if (!Number.isInteger(id) || id <= 0) {
    return {
      status: "error",
      message: null,
      formError: "Could not delete the note.",
      noteId: Number.isInteger(id) ? id : null,
    };
  }

  const result = await deleteCustomerNote(customerId, id, notePreviewLabel(label));

  if (result.status === "success") {
    revalidatePath(`/customers/${customerId}`);
  }

  return result;
}

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}
