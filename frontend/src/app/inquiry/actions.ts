"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { caseDetailsHref } from "@/lib/cases-shared";
import { withNotice } from "@/lib/flash-notice";
import {
  createInquiry,
  resolveCustomer,
  type CreateInquiryRequest,
  type InquiryFormState,
  type InquiryFormValues,
  type ResolveCustomerResponse,
} from "@/lib/inquiries";

export async function resolveCustomerAction(email: string): Promise<ResolveCustomerResponse> {
  return await resolveCustomer(email);
}

export async function createInquiryAction(
  previous: InquiryFormState,
  formData: FormData,
): Promise<InquiryFormState> {
  const customerName = text(formData, "customerName").trim();
  const customerEmail = text(formData, "customerEmail").trim();
  const customerPhone = text(formData, "customerPhone").trim();
  const customerCompany = text(formData, "customerCompany").trim();
  const selectedCustomerIdRaw = text(formData, "selectedCustomerId").trim();
  const confirmCreateNew = formData.get("confirmCreateNew") === "true" || formData.get("confirmCreateNew") === "on";
  const title = text(formData, "title").trim();
  const description = text(formData, "description").trim();

  const selectedCustomerId = selectedCustomerIdRaw ? Number(selectedCustomerIdRaw) : null;

  const formValues: InquiryFormValues = {
    customerName,
    customerEmail,
    customerPhone,
    customerCompany,
    selectedCustomerId: selectedCustomerIdRaw,
    confirmCreateNew,
    title,
    description,
  };

  const request: CreateInquiryRequest = {
    customerName: customerName || undefined,
    customerEmail: customerEmail || undefined,
    customerPhone: customerPhone || null,
    customerCompany: customerCompany || null,
    selectedCustomerId: Number.isInteger(selectedCustomerId) && selectedCustomerId! > 0 ? selectedCustomerId : null,
    confirmCreateNew,
    title,
    description: description || null,
  };

  const result = await createInquiry(request, formValues);

  if (result.status === "success" && result.savedCaseId) {
    revalidatePath("/cases");
    revalidatePath("/customers");
    revalidatePath("/");
    redirect(
      withNotice(
        caseDetailsHref(result.savedCaseId),
        `Inquiry logged. Case #${result.savedCaseId} opened for ${result.message ? "customer" : "case"}.`,
      ),
    );
  }

  return {
    ...result,
    revision: previous.revision + 1,
  };
}

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}
