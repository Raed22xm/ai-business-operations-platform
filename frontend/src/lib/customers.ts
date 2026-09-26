import type {
  CustomerField,
  CustomerFormState,
  DeleteCustomerState,
} from "@/lib/customer-form-state";

export type Customer = {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  company: string | null;
};

export type NewCustomer = {
  name: string;
  email: string;
  phone: string | null;
  company: string | null;
};

export async function getCustomers(): Promise<Customer[]> {
  const response = await fetch(customersUrl(), { cache: "no-store" });

  if (!response.ok) {
    throw new Error(`Could not load customers (${response.status}).`);
  }

  const body: unknown = await response.json();

  if (!Array.isArray(body) || !body.every(isCustomer)) {
    throw new Error("Customer list had an unexpected shape.");
  }

  return body;
}

export function createCustomer(input: NewCustomer): Promise<CustomerFormState> {
  return saveCustomer(customersUrl(), "POST", 201, input, (name) => `${name} was added.`);
}

export function updateCustomer(
  id: number,
  input: NewCustomer,
): Promise<CustomerFormState> {
  return saveCustomer(
    `${customersUrl()}/${id}`,
    "PUT",
    200,
    input,
    (name) => `${name} was updated.`,
  );
}

export async function deleteCustomer(
  id: number,
  name: string,
): Promise<DeleteCustomerState> {
  let response: Response;

  try {
    response = await fetch(`${customersUrl()}/${id}`, {
      method: "DELETE",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
  } catch {
    return deleteError(
      id,
      "Could not delete the customer. Check that the API is running.",
    );
  }

  if (response.status === 204) {
    return {
      status: "success",
      message: `${name} was deleted.`,
      formError: null,
      customerId: id,
    };
  }

  if (response.status === 404) {
    return deleteError(id, "That customer was not found.");
  }

  if (response.status === 409) {
    return deleteError(id, await readConflictDetail(response));
  }

  return deleteError(id, `Could not delete the customer (${response.status}).`);
}

async function readConflictDetail(response: Response): Promise<string> {
  const fallback = "This customer has cases and cannot be deleted.";
  const body: unknown = await response.json().catch(() => null);
  if (typeof body !== "object" || body === null || !("detail" in body)) {
    return fallback;
  }

  const detail = body.detail;
  return typeof detail === "string" && detail.trim() !== "" ? detail : fallback;
}

async function saveCustomer(
  url: string,
  method: "POST" | "PUT",
  successStatus: number,
  input: NewCustomer,
  successMessage: (name: string) => string,
): Promise<CustomerFormState> {
  let response: Response;

  try {
    response = await fetch(url, {
      method,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
      cache: "no-store",
    });
  } catch {
    return errorState(
      "Could not save the customer. Check that the API is running.",
    );
  }

  if (response.status === successStatus) {
    const body: unknown = await response.json();
    if (!isCustomer(body)) {
      return errorState("The API returned an unexpected customer.");
    }

    return {
      status: "success",
      message: successMessage(body.name),
      formError: null,
      fieldErrors: {},
      revision: 0,
    };
  }

  if (response.status === 400) {
    const fieldErrors = await readFieldErrors(response);
    return {
      status: "error",
      message: null,
      formError:
        Object.keys(fieldErrors).length === 0
          ? "Could not save the customer."
          : null,
      fieldErrors,
      revision: 0,
    };
  }

  return errorState(`Could not save the customer (${response.status}).`);
}

function deleteError(customerId: number, formError: string): DeleteCustomerState {
  return {
    status: "error",
    message: null,
    formError,
    customerId,
  };
}

function errorState(formError: string): CustomerFormState {
  return {
    status: "error",
    message: null,
    formError,
    fieldErrors: {},
    revision: 0,
  };
}

async function readFieldErrors(
  response: Response,
): Promise<Partial<Record<CustomerField, string>>> {
  const body: unknown = await response.json().catch(() => null);
  if (typeof body !== "object" || body === null || !("errors" in body)) {
    return {};
  }

  const errors = body.errors;
  if (typeof errors !== "object" || errors === null) {
    return {};
  }

  const fieldErrors: Partial<Record<CustomerField, string>> = {};
  for (const [key, messages] of Object.entries(errors)) {
    const field = key.toLowerCase();
    const message = Array.isArray(messages) ? messages[0] : null;
    if (isCustomerField(field) && typeof message === "string") {
      fieldErrors[field] = message;
    }
  }

  return fieldErrors;
}

function isCustomerField(value: string): value is CustomerField {
  return (
    value === "name" ||
    value === "email" ||
    value === "phone" ||
    value === "company"
  );
}

function customersUrl(): string {
  const baseUrl = process.env.API_BASE_URL?.trim();

  if (!baseUrl) {
    throw new Error(
      "Missing API_BASE_URL. Set it in frontend/.env.local, for example http://localhost:5222.",
    );
  }

  return `${baseUrl.replace(/\/$/, "")}/api/customers`;
}

function isCustomer(value: unknown): value is Customer {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const row = value as Record<string, unknown>;

  return (
    typeof row.id === "number" &&
    typeof row.name === "string" &&
    typeof row.email === "string" &&
    isOptionalText(row.phone) &&
    isOptionalText(row.company)
  );
}

function isOptionalText(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}
