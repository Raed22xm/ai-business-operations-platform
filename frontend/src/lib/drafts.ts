import "server-only";

import { apiFetch } from "@/lib/api";
import {
  isResponseDraft,
  type ResponseDraft,
} from "@/lib/drafts-shared";

function draftsBaseUrl(caseId: number): string {
  const baseUrl = process.env.API_BASE_URL?.trim();
  if (!baseUrl) {
    throw new Error(
      "Missing API_BASE_URL. Set it in frontend/.env.local, for example http://localhost:5222.",
    );
  }
  return `${baseUrl.replace(/\/$/, "")}/api/cases/${caseId}/drafts`;
}

export type DraftOperationResult = {
  draft?: ResponseDraft;
  error?: string;
  conflict?: {
    currentVersion: number;
    currentContent: string;
  };
};

export async function getCaseDrafts(caseId: number): Promise<ResponseDraft[]> {
  if (!Number.isInteger(caseId) || caseId <= 0) {
    return [];
  }

  let response: Response;
  try {
    response = await apiFetch(draftsBaseUrl(caseId), {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
  } catch {
    throw new Error("Could not load drafts. Check that the API is running.");
  }

  if (response.status === 404) {
    throw new Error("That case was not found.");
  }

  if (!response.ok) {
    throw new Error(`Could not load drafts (${response.status}).`);
  }

  const body: unknown = await response.json();
  if (!Array.isArray(body) || !body.every(isResponseDraft)) {
    throw new Error("The API returned an unexpected drafts shape.");
  }

  return body;
}

export async function createDraft(
  caseId: number,
  content: string,
): Promise<DraftOperationResult> {
  let response: Response;
  try {
    response = await apiFetch(draftsBaseUrl(caseId), {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ content }),
      cache: "no-store",
    });
  } catch {
    return { error: "Network error: could not save draft. Check that the API is running." };
  }

  if (response.status === 409) {
    const errorDetails = await parseProblemDetails(response);
    return { error: errorDetails.detail || "Case is archived and cannot receive new drafts." };
  }

  if (response.status === 400) {
    const problem = await response.json().catch(() => null);
    const msg = extractValidationErrorMessage(problem);
    return { error: msg || "Draft text is invalid or exceeds the maximum length." };
  }

  if (!response.ok) {
    return { error: `Could not create draft (${response.status}).` };
  }

  const body: unknown = await response.json().catch(() => null);
  if (!isResponseDraft(body)) {
    return { error: "Draft was created but API returned unexpected data." };
  }

  return { draft: body };
}

export async function generateAndSaveDraft(caseId: number): Promise<DraftOperationResult> {
  let response: Response;
  try {
    response = await apiFetch(`${draftsBaseUrl(caseId)}/generate-and-save`, {
      method: "POST",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
  } catch {
    return { error: "Network error: could not generate AI draft. Check that the API is running." };
  }

  if (response.status === 409) {
    const errorDetails = await parseProblemDetails(response);
    return { error: errorDetails.detail || "Case is archived and cannot receive new drafts." };
  }

  if (response.status === 502 || response.status === 504) {
    return { error: "AI service is currently unavailable or timed out. Please try again." };
  }

  if (!response.ok) {
    return { error: `Could not generate AI draft (${response.status}).` };
  }

  const body: unknown = await response.json().catch(() => null);
  if (!isResponseDraft(body)) {
    return { error: "AI draft was created but API returned unexpected data." };
  }

  return { draft: body };
}

export async function updateDraft(
  caseId: number,
  draftId: number,
  content: string,
  expectedVersion: number,
): Promise<DraftOperationResult> {
  let response: Response;
  try {
    response = await apiFetch(`${draftsBaseUrl(caseId)}/${draftId}`, {
      method: "PUT",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ content, expectedVersion }),
      cache: "no-store",
    });
  } catch {
    return { error: "Network error: could not save draft edits. Your text is preserved." };
  }

  if (response.status === 409) {
    const conflict = await parseConflictDetails(response);
    return {
      error: conflict.detail || "Conflicting update: This draft was modified by another user or tab.",
      conflict: conflict.conflict,
    };
  }

  if (response.status === 400) {
    const problem = await response.json().catch(() => null);
    const msg = extractValidationErrorMessage(problem);
    return { error: msg || "Draft text is invalid or exceeds the maximum length." };
  }

  if (!response.ok) {
    return { error: `Could not save draft edits (${response.status}).` };
  }

  const body: unknown = await response.json().catch(() => null);
  if (!isResponseDraft(body)) {
    return { error: "Draft was updated but API returned unexpected data." };
  }

  return { draft: body };
}

export async function approveDraft(
  caseId: number,
  draftId: number,
  approvedContent: string,
  expectedVersion: number,
): Promise<DraftOperationResult> {
  let response: Response;
  try {
    response = await apiFetch(`${draftsBaseUrl(caseId)}/${draftId}/approve`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ approvedContent, expectedVersion }),
      cache: "no-store",
    });
  } catch {
    return { error: "Network error: could not approve draft. Check that the API is running." };
  }

  if (response.status === 409) {
    const conflict = await parseConflictDetails(response);
    return {
      error: conflict.detail || "Conflicting update: This draft was modified before approval.",
      conflict: conflict.conflict,
    };
  }

  if (response.status === 400) {
    const problem = await response.json().catch(() => null);
    const msg = extractValidationErrorMessage(problem);
    return {
      error:
        msg ||
        "Approval applies only to the exact saved text. Save any pending edits before approving.",
    };
  }

  if (!response.ok) {
    return { error: `Could not approve draft (${response.status}).` };
  }

  const body: unknown = await response.json().catch(() => null);
  if (!isResponseDraft(body)) {
    return { error: "Draft was approved but API returned unexpected data." };
  }

  return { draft: body };
}

export async function deleteDraft(
  caseId: number,
  draftId: number,
): Promise<{ success: boolean; error?: string }> {
  let response: Response;
  try {
    response = await apiFetch(`${draftsBaseUrl(caseId)}/${draftId}`, {
      method: "DELETE",
      cache: "no-store",
    });
  } catch {
    return { success: false, error: "Network error: could not delete draft." };
  }

  if (response.status === 409) {
    const details = await parseProblemDetails(response);
    return { success: false, error: details.detail || "Case is archived and drafts cannot be deleted." };
  }

  if (!response.ok && response.status !== 204) {
    return { success: false, error: `Could not delete draft (${response.status}).` };
  }

  return { success: true };
}

async function parseProblemDetails(response: Response): Promise<{ title?: string; detail?: string }> {
  const json = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  return {
    title: typeof json?.title === "string" ? json.title : undefined,
    detail: typeof json?.detail === "string" ? json.detail : undefined,
  };
}

async function parseConflictDetails(
  response: Response,
): Promise<{
  detail?: string;
  conflict?: { currentVersion: number; currentContent: string };
}> {
  const json = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  if (!json) {
    return {};
  }

  const detail = typeof json.detail === "string" ? json.detail : undefined;
  const ext = (json.extensions as Record<string, unknown> | undefined) ?? json;
  const currentVersion =
    typeof ext.currentVersion === "number" ? ext.currentVersion : undefined;
  const currentContent =
    typeof ext.currentContent === "string" ? ext.currentContent : undefined;

  if (currentVersion !== undefined && currentContent !== undefined) {
    return { detail, conflict: { currentVersion, currentContent } };
  }

  return { detail };
}

function extractValidationErrorMessage(problem: unknown): string | null {
  if (typeof problem !== "object" || problem === null) {
    return null;
  }
  const rec = problem as Record<string, unknown>;
  if (typeof rec.detail === "string") {
    return rec.detail;
  }
  if (rec.errors && typeof rec.errors === "object") {
    for (const val of Object.values(rec.errors as Record<string, unknown>)) {
      if (Array.isArray(val) && val.length > 0 && typeof val[0] === "string") {
        return val[0];
      }
    }
  }
  return null;
}
