"use server";

import {
  draftCaseResponse,
  generateCaseSummary,
  type AssistantResult,
} from "@/lib/assistant";

export async function generateCaseSummaryAction(caseId: number): Promise<AssistantResult> {
  try {
    return await generateCaseSummary(caseId);
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Could not generate a summary.",
      retryable: true,
    };
  }
}

export async function draftCaseResponseAction(caseId: number): Promise<AssistantResult> {
  try {
    return await draftCaseResponse(caseId);
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Could not draft a response.",
      retryable: true,
    };
  }
}
