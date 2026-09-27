"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type {
  CustomerFormState,
  DeleteCustomerState,
} from "@/lib/customer-form-state";
import {
  createCustomer,
  customersPageHref,
  deleteCustomer,
  updateCustomer,
} from "@/lib/customers";
import { withNotice } from "@/lib/flash-notice";

export async function createCustomerAction(
  _previous: CustomerFormState,
  formData: FormData,
): Promise<CustomerFormState> {
  const result = await createCustomer(customerFromForm(formData));

  if (result.status === "success") {
    revalidatePath("/customers");
  }

  return {
    ...result,
    revision: result.status === "success" ? _previous.revision + 1 : _previous.revision,
  };
}

export async function updateCustomerAction(
  id: number,
  previous: CustomerFormState,
  formData: FormData,
): Promise<CustomerFormState> {
  const result = await updateCustomer(id, customerFromForm(formData));

  if (result.status === "success") {
    revalidatePath("/customers");
    revalidatePath(`/customers/${id}`);
  }

  return {
    ...result,
    revision: result.status === "success" ? previous.revision + 1 : previous.revision,
  };
}

export async function deleteCustomerAction(
  _previous: DeleteCustomerState,
  formData: FormData,
): Promise<DeleteCustomerState> {
  const id = Number(formData.get("id"));
  const name = text(formData, "name").trim();

  if (!Number.isInteger(id) || id <= 0 || name === "") {
    return {
      status: "error",
      message: null,
      formError: "Could not delete the customer.",
      customerId: Number.isInteger(id) ? id : null,
    };
  }

  const result = await deleteCustomer(id, name);

  if (result.status === "success" && result.message) {
    revalidatePath("/customers");
    const search = text(formData, "listSearch").trim();
    const page = parseListPage(text(formData, "listPage"));
    const soleRow = text(formData, "soleRow") === "1";
    const destinationPage =
      soleRow && page > 1 ? (page - 1 > 1 ? page - 1 : null) : page > 1 ? page : null;
    redirect(
      withNotice(
        customersPageHref(search === "" ? null : search, destinationPage),
        result.message,
      ),
    );
  }

  return result;
}

function parseListPage(value: string): number {
  if (!/^[1-9]\d*$/.test(value)) {
    return 1;
  }

  return Number(value);
}

function customerFromForm(formData: FormData) {
  return {
    name: text(formData, "name").trim(),
    email: text(formData, "email").trim(),
    phone: optional(text(formData, "phone")),
    company: optional(text(formData, "company")),
  };
}

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function optional(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}
