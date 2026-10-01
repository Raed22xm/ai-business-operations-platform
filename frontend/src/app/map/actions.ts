"use server";

import { revalidatePath } from "next/cache";
import { apiFetch } from "@/lib/api";
import type { Customer } from "@/lib/customers-shared";
import type { NewCustomer } from "@/lib/customers";

function isCustomer(value: unknown): value is Customer {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const row = value as Record<string, unknown>;
  return (
    typeof row.id === "number" &&
    typeof row.name === "string" &&
    typeof row.email === "string" &&
    (row.phone === null || typeof row.phone === "string") &&
    (row.company === null || typeof row.company === "string") &&
    typeof row.createdAt === "string"
  );
}

export type AddPersonResult =
  | { status: "success"; customer: Customer }
  | { status: "error"; message: string };

export async function addPersonFromMapAction(input: NewCustomer): Promise<AddPersonResult> {
  const baseUrl = process.env.API_BASE_URL?.trim();
  if (!baseUrl) {
    return { status: "error", message: "API_BASE_URL is missing in environment." };
  }

  const name = input.name.trim();
  const email = input.email.trim();

  if (!name) {
    return { status: "error", message: "Name is required." };
  }
  if (!email) {
    return { status: "error", message: "Email is required." };
  }

  try {
    const response = await apiFetch(`${baseUrl.replace(/\/$/, "")}/api/customers`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name,
        email,
        phone: input.phone?.trim() || null,
        company: input.company?.trim() || null,
      }),
      cache: "no-store",
    });

    if (response.status === 201) {
      const body: unknown = await response.json();
      if (isCustomer(body)) {
        revalidatePath("/map");
        revalidatePath("/customers");
        return { status: "success", customer: body };
      }
    }

    if (response.status === 400) {
      const problem = (await response.json().catch(() => null)) as
        | { errors?: Record<string, string[]> }
        | null;
      const errors = problem?.errors || {};
      const firstError = Object.values(errors).flat()[0] || "Invalid customer input.";
      return { status: "error", message: firstError };
    }

    return { status: "error", message: `Server error (${response.status})` };
  } catch (err) {
    return {
      status: "error",
      message: err instanceof Error ? err.message : "Failed to add person.",
    };
  }
}
