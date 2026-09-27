"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { CaseFormState, DeleteCaseState } from "@/lib/case-form-state";
import {
  casesPageHref,
  createCase,
  deleteCase,
  archiveCase,
  restoreCase,
  isCaseArchiveFilter,
  updateCase,
  type CaseArchiveFilter,
  type CaseStatus,
} from "@/lib/cases";
import { withNotice } from "@/lib/flash-notice";

export async function createCaseAction(
  previous: CaseFormState,
  formData: FormData,
): Promise<CaseFormState> {
  const result = await createCase(caseFromForm(formData));

  if (result.status === "success") {
    revalidatePath("/cases");
  }

  return {
    ...result,
    revision: result.status === "success" ? previous.revision + 1 : previous.revision,
  };
}

export async function updateCaseAction(
  id: number,
  previous: CaseFormState,
  formData: FormData,
): Promise<CaseFormState> {
  const status = readStatus(text(formData, "status"));
  if (!status) {
    return {
      status: "error",
      message: null,
      formError: null,
      fieldErrors: { status: "Status must be Open, InProgress, or Closed." },
      revision: previous.revision,
      customerId: null,
    };
  }

  const description = text(formData, "description").trim();
  const result = await updateCase(id, {
    title: text(formData, "title").trim(),
    description: description === "" ? null : description,
    status,
  });

  if (result.status === "success") {
    revalidatePath("/cases");
    revalidatePath(`/cases/${id}`);
  }

  return {
    ...result,
    revision: result.status === "success" ? previous.revision + 1 : previous.revision,
  };
}

export async function deleteCaseAction(
  _previous: DeleteCaseState,
  formData: FormData,
): Promise<DeleteCaseState> {
  const id = Number(formData.get("id"));
  const title = text(formData, "title").trim();

  if (!Number.isInteger(id) || id <= 0 || title === "") {
    return {
      status: "error",
      message: null,
      formError: "Could not delete the case.",
      caseId: Number.isInteger(id) ? id : null,
    };
  }

  const result = await deleteCase(id, title);

  if (result.status === "success" && result.message) {
    revalidatePath("/cases");
    const customerRaw = text(formData, "listCustomerId").trim();
    const customerId =
      customerRaw !== "" && /^[1-9]\d*$/.test(customerRaw) ? Number(customerRaw) : null;
    const status = readStatus(text(formData, "listStatus").trim());
    const search = text(formData, "listSearch").trim();
    const archive = readArchiveFilter(text(formData, "listArchive").trim());
    const page = parseListPage(text(formData, "listPage"));
    const soleRow = text(formData, "soleRow") === "1";
    const destinationPage =
      soleRow && page > 1 ? (page - 1 > 1 ? page - 1 : null) : page > 1 ? page : null;
    redirect(
      withNotice(
        casesPageHref(
          customerId,
          status,
          search === "" ? null : search,
          destinationPage,
          archive,
        ),
        result.message,
      ),
    );
  }

  return result;
}

export async function archiveCaseAction(
  _previous: DeleteCaseState,
  formData: FormData,
): Promise<DeleteCaseState> {
  const id = Number(formData.get("id"));
  const title = text(formData, "title").trim();

  if (!Number.isInteger(id) || id <= 0 || title === "") {
    return {
      status: "error",
      message: null,
      formError: "Could not archive the case.",
      caseId: Number.isInteger(id) ? id : null,
    };
  }

  const result = await archiveCase(id, title);

  if (result.status === "success" && result.message) {
    revalidatePath("/cases");
    revalidatePath(`/cases/${id}`);
    redirect(withNotice(caseReturnHref(formData, id), result.message));
  }

  return result;
}

export async function restoreCaseAction(
  _previous: DeleteCaseState,
  formData: FormData,
): Promise<DeleteCaseState> {
  const id = Number(formData.get("id"));
  const title = text(formData, "title").trim();

  if (!Number.isInteger(id) || id <= 0 || title === "") {
    return {
      status: "error",
      message: null,
      formError: "Could not restore the case.",
      caseId: Number.isInteger(id) ? id : null,
    };
  }

  const result = await restoreCase(id, title);

  if (result.status === "success" && result.message) {
    revalidatePath("/cases");
    revalidatePath(`/cases/${id}`);
    redirect(withNotice(caseReturnHref(formData, id), result.message));
  }

  return result;
}

function caseReturnHref(formData: FormData, caseId: number): string {
  const returnTo = text(formData, "returnTo").trim();
  if (returnTo === "list") {
    const customerRaw = text(formData, "listCustomerId").trim();
    const customerId =
      customerRaw !== "" && /^[1-9]\d*$/.test(customerRaw) ? Number(customerRaw) : null;
    const status = readStatus(text(formData, "listStatus").trim());
    const search = text(formData, "listSearch").trim();
    const archive = readArchiveFilter(text(formData, "listArchive").trim());
    const page = parseListPage(text(formData, "listPage"));
    return casesPageHref(
      customerId,
      status,
      search === "" ? null : search,
      page > 1 ? page : null,
      archive,
    );
  }

  const customerRaw = text(formData, "listCustomerId").trim();
  const customerId =
    customerRaw !== "" && /^[1-9]\d*$/.test(customerRaw) ? Number(customerRaw) : null;
  const status = readStatus(text(formData, "listStatus").trim());
  const search = text(formData, "listSearch").trim();
  const archive = readArchiveFilter(text(formData, "listArchive").trim());
  const page = parseListPage(text(formData, "listPage"));
  const params = new URLSearchParams();
  if (customerId !== null) {
    params.set("customerId", String(customerId));
  }
  if (status) {
    params.set("status", status);
  }
  if (search !== "") {
    params.set("search", search);
  }
  if (archive && archive !== "active") {
    params.set("archive", archive);
  }
  if (page > 1) {
    params.set("page", String(page));
  }
  const query = params.toString();
  return query === "" ? `/cases/${caseId}` : `/cases/${caseId}?${query}`;
}

function parseListPage(value: string): number {
  if (!/^[1-9]\d*$/.test(value)) {
    return 1;
  }

  return Number(value);
}

function caseFromForm(formData: FormData) {
  const rawCustomerId = text(formData, "customerId").trim();
  const customerId = /^[1-9]\d*$/.test(rawCustomerId) ? Number(rawCustomerId) : 0;
  const description = text(formData, "description").trim();

  return {
    customerId,
    title: text(formData, "title").trim(),
    description: description === "" ? null : description,
  };
}

function readStatus(value: string): CaseStatus | null {
  if (value === "Open" || value === "InProgress" || value === "Closed") {
    return value;
  }

  return null;
}

function readArchiveFilter(value: string): CaseArchiveFilter | null {
  if (isCaseArchiveFilter(value)) {
    return value === "active" ? null : value;
  }

  return null;
}

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}
