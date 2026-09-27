export type CaseSummaryResult = {
  caseId: number;
  requestSummary: string;
  status: string;
  outstandingTasks: string[];
  suggestedNextAction: string;
  formattedText: string;
  source: "openai" | "mock";
  model: string;
  setupHint: string | null;
};

export type DraftResponseResult = {
  caseId: number;
  draftText: string;
  source: "openai" | "mock";
  model: string;
  setupHint: string | null;
};

export type AssistantResult =
  | { status: "success"; kind: "summary"; data: CaseSummaryResult }
  | { status: "success"; kind: "draft"; data: DraftResponseResult }
  | { status: "error"; message: string; retryable: boolean };

export async function generateCaseSummary(caseId: number): Promise<AssistantResult> {
  return postAssistant(caseId, "summary");
}

export async function draftCaseResponse(caseId: number): Promise<AssistantResult> {
  return postAssistant(caseId, "draft-response");
}

async function postAssistant(
  caseId: number,
  action: "summary" | "draft-response",
): Promise<AssistantResult> {
  if (!Number.isInteger(caseId) || caseId <= 0) {
    return { status: "error", message: "Select a case before generating.", retryable: false };
  }

  let response: Response;
  try {
    response = await fetch(assistantUrl(caseId, action), {
      method: "POST",
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

  if (response.status === 504) {
    return {
      status: "error",
      message: "The AI provider timed out. Try again in a moment.",
      retryable: true,
    };
  }

  if (response.status === 502) {
    return {
      status: "error",
      message: "The AI provider failed. Try again, or check OpenAI configuration.",
      retryable: true,
    };
  }

  if (!response.ok) {
    return {
      status: "error",
      message: `Could not generate (${response.status}).`,
      retryable: true,
    };
  }

  const body: unknown = await response.json();
  if (action === "summary") {
    if (!isCaseSummary(body)) {
      return {
        status: "error",
        message: "Summary response had an unexpected shape.",
        retryable: true,
      };
    }
    return { status: "success", kind: "summary", data: body };
  }

  if (!isDraftResponse(body)) {
    return {
      status: "error",
      message: "Draft response had an unexpected shape.",
      retryable: true,
    };
  }
  return { status: "success", kind: "draft", data: body };
}

function assistantUrl(caseId: number, action: "summary" | "draft-response"): string {
  const baseUrl = process.env.API_BASE_URL?.trim();
  if (!baseUrl) {
    throw new Error(
      "Missing API_BASE_URL. Set it in frontend/.env.local, for example http://localhost:5222.",
    );
  }
  return `${baseUrl.replace(/\/$/, "")}/api/assistant/cases/${caseId}/${action}`;
}

function isCaseSummary(value: unknown): value is CaseSummaryResult {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const row = value as Record<string, unknown>;
  return (
    typeof row.caseId === "number" &&
    typeof row.requestSummary === "string" &&
    typeof row.status === "string" &&
    Array.isArray(row.outstandingTasks) &&
    row.outstandingTasks.every((item) => typeof item === "string") &&
    typeof row.suggestedNextAction === "string" &&
    typeof row.formattedText === "string" &&
    (row.source === "openai" || row.source === "mock") &&
    typeof row.model === "string" &&
    (row.setupHint === null || typeof row.setupHint === "string" || row.setupHint === undefined)
  );
}

function isDraftResponse(value: unknown): value is DraftResponseResult {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const row = value as Record<string, unknown>;
  return (
    typeof row.caseId === "number" &&
    typeof row.draftText === "string" &&
    (row.source === "openai" || row.source === "mock") &&
    typeof row.model === "string" &&
    (row.setupHint === null || typeof row.setupHint === "string" || row.setupHint === undefined)
  );
}
