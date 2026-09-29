import "server-only";
import { apiFetch } from "@/lib/api";
import type { CaseEscalationResult } from "@/lib/escalation-shared";

export type EscalationCheckResult =
  | { status: "success"; data: CaseEscalationResult }
  | { status: "error"; message: string; retryable: boolean };

export async function checkCaseEscalation(caseId: number): Promise<EscalationCheckResult> {
  if (!Number.isInteger(caseId) || caseId <= 0) {
    return {
      status: "error",
      message: "Select a case before checking escalation.",
      retryable: false,
    };
  }

  const baseUrl = process.env.API_BASE_URL?.trim();
  if (!baseUrl) {
    throw new Error(
      "Missing API_BASE_URL. Set it in frontend/.env.local, for example http://localhost:5222.",
    );
  }

  const url = `${baseUrl.replace(/\/$/, "")}/api/assistant/cases/${caseId}/escalation-check`;

  let response: Response;
  try {
    response = await apiFetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
  } catch {
    return {
      status: "error",
      message: "Could not reach the API. Check that the backend is running.",
      retryable: true,
    };
  }

  if (response.status === 404) {
    return {
      status: "error",
      message: "That case was not found. Refresh the dashboard and try again.",
      retryable: false,
    };
  }

  if (response.status === 409) {
    return {
      status: "error",
      message: "This case is archived and cannot be evaluated for escalation.",
      retryable: false,
    };
  }

  if (response.status === 401) {
    return {
      status: "error",
      message: "Your session expired. Sign in again to continue.",
      retryable: false,
    };
  }

  if (!response.ok) {
    return {
      status: "error",
      message: `Could not check escalation (${response.status}).`,
      retryable: true,
    };
  }

  const body: unknown = await response.json();
  if (!isCaseEscalation(body)) {
    return {
      status: "error",
      message: "Escalation check response had an unexpected shape.",
      retryable: true,
    };
  }

  return { status: "success", data: body };
}

function isCaseEscalation(value: unknown): value is CaseEscalationResult {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const row = value as Record<string, unknown>;
  return (
    typeof row.caseId === "number" &&
    typeof row.caseTitle === "string" &&
    typeof row.caseStatus === "string" &&
    typeof row.needsReview === "boolean" &&
    typeof row.summaryMessage === "string" &&
    Array.isArray(row.flags) &&
    row.flags.every(
      (item) =>
        typeof item === "object" &&
        item !== null &&
        typeof (item as Record<string, unknown>).rule === "string" &&
        typeof (item as Record<string, unknown>).reason === "string" &&
        ((item as Record<string, unknown>).taskId === null ||
          typeof (item as Record<string, unknown>).taskId === "number") &&
        ((item as Record<string, unknown>).taskTitle === null ||
          typeof (item as Record<string, unknown>).taskTitle === "string") &&
        typeof (item as Record<string, unknown>).severity === "string",
    )
  );
}
