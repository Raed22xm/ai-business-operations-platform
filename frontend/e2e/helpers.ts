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

function authHeaders(state: E2EState): Record<string, string> {
  if (!state.accessToken) {
    return {};
  }
  return { Authorization: `Bearer ${state.accessToken}` };
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
  accessToken?: string,
): Promise<{ id: number; name: string; email: string }> {
  const token = accessToken ?? readState().accessToken;
  const response = await request.post(`${apiURL}/api/customers`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
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
  accessToken?: string,
): Promise<{ id: number; title: string; customerId: number; status: string }> {
  const token = accessToken ?? readState().accessToken;
  const response = await request.post(`${apiURL}/api/cases`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
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
  accessToken?: string,
): Promise<void> {
  const token = accessToken ?? readState().accessToken;
  await request.delete(`${apiURL}/api/customers/${id}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
}

export async function deleteCaseViaApi(
  request: APIRequestContext,
  apiURL: string,
  id: number,
  accessToken?: string,
): Promise<void> {
  const token = accessToken ?? readState().accessToken;
  await request.delete(`${apiURL}/api/cases/${id}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
}

export async function createTaskViaApi(
  request: APIRequestContext,
  apiURL: string,
  task: {
    caseId: number;
    title: string;
    description?: string | null;
    dueDate?: string | null;
    priority?: "Low" | "Normal" | "High";
  },
  accessToken?: string,
): Promise<{
  id: number;
  title: string;
  caseId: number;
  status: string;
  priority: string;
  dueDate: string | null;
}> {
  const token = accessToken ?? readState().accessToken;
  const response = await request.post(`${apiURL}/api/tasks`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    data: {
      caseId: task.caseId,
      title: task.title,
      description: task.description ?? null,
      dueDate: task.dueDate ?? null,
      ...(task.priority !== undefined ? { priority: task.priority } : {}),
    },
  });
  expect(response.ok()).toBeTruthy();
  return (await response.json()) as {
    id: number;
    title: string;
    caseId: number;
    status: string;
    priority: string;
    dueDate: string | null;
  };
}

export async function deleteTaskViaApi(
  request: APIRequestContext,
  apiURL: string,
  id: number,
  accessToken?: string,
): Promise<void> {
  const token = accessToken ?? readState().accessToken;
  await request.delete(`${apiURL}/api/tasks/${id}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
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

export function bearerHeaders(e2e: E2EState): Record<string, string> | undefined {
  return e2e.accessToken ? { Authorization: `Bearer ${e2e.accessToken}` } : undefined;
}

export { authHeaders };
