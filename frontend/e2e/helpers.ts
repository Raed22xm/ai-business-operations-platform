import fs from "node:fs";
import { test as base, expect, type APIRequestContext, type Page } from "@playwright/test";
import { statePath, type E2EState } from "./env";

function readState(): E2EState {
  if (!fs.existsSync(statePath)) {
    return {
      skipped: true,
      skipReason: "Browser e2e not run: global setup did not produce a state file.",
      baseURL: "http://localhost:3100",
      apiURL: "http://127.0.0.1:5230",
    };
  }
  return JSON.parse(fs.readFileSync(statePath, "utf8")) as E2EState;
}

export const test = base.extend<{ e2e: E2EState }>({
  e2e: async ({}, use, testInfo) => {
    const state = readState();
    if (state.skipped) {
      testInfo.skip(true, state.skipReason ?? "Browser e2e environment unavailable.");
    }
    await use(state);
  },
});

export { expect };

export function uniqueMarker(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
}

export async function createCustomerViaApi(
  request: APIRequestContext,
  apiURL: string,
  customer: { name: string; email: string; phone?: string | null; company?: string | null },
): Promise<{ id: number; name: string; email: string }> {
  const response = await request.post(`${apiURL}/api/customers`, {
    data: {
      name: customer.name,
      email: customer.email,
      phone: customer.phone ?? null,
      company: customer.company ?? null,
    },
  });
  expect(response.ok()).toBeTruthy();
  return (await response.json()) as { id: number; name: string; email: string };
}

export async function createCaseViaApi(
  request: APIRequestContext,
  apiURL: string,
  work: { customerId: number; title: string; description?: string | null },
): Promise<{ id: number; title: string; customerId: number; status: string }> {
  const response = await request.post(`${apiURL}/api/cases`, {
    data: {
      customerId: work.customerId,
      title: work.title,
      description: work.description ?? null,
    },
  });
  expect(response.ok()).toBeTruthy();
  return (await response.json()) as {
    id: number;
    title: string;
    customerId: number;
    status: string;
  };
}

export async function deleteCustomerViaApi(
  request: APIRequestContext,
  apiURL: string,
  id: number,
): Promise<void> {
  await request.delete(`${apiURL}/api/customers/${id}`);
}

export async function deleteCaseViaApi(
  request: APIRequestContext,
  apiURL: string,
  id: number,
): Promise<void> {
  await request.delete(`${apiURL}/api/cases/${id}`);
}

export async function fillCustomerForm(
  page: Page,
  values: { name: string; email: string; phone?: string; company?: string },
): Promise<void> {
  const form = page.getByRole("form", { name: "Add customer" });
  await form.getByLabel("Name").fill(values.name);
  await form.getByLabel("Email").fill(values.email);
  if (values.phone) {
    await form.getByLabel("Phone").fill(values.phone);
  }
  if (values.company) {
    await form.getByLabel("Company").fill(values.company);
  }
}

export async function confirmDeleteDialog(page: Page): Promise<void> {
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: /^Delete$/ }).click();
}
