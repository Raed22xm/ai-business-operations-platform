"use server";

import { revalidatePath } from "next/cache";
import {
  approveDraft,
  createDraft,
  deleteDraft,
  generateAndSaveDraft,
  getCaseDrafts,
  updateDraft,
} from "@/lib/drafts";
import type { ResponseDraft } from "@/lib/drafts-shared";

export type DraftActionResult =
  | {
      status: "success";
      draft: ResponseDraft;
      message?: string;
    }
  | {
      status: "error";
      message: string;
      conflict?: {
        currentVersion: number;
        currentContent: string;
      };
    };

export async function loadCaseDraftsAction(
  caseId: number,
): Promise<{ status: "success"; drafts: ResponseDraft[] } | { status: "error"; message: string }> {
  try {
    const drafts = await getCaseDrafts(caseId);
    return { status: "success", drafts };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Could not load drafts.",
    };
  }
}

export async function createDraftAction(
  caseId: number,
  content: string,
): Promise<DraftActionResult> {
  if (!Number.isInteger(caseId) || caseId <= 0) {
    return { status: "error", message: "Invalid case ID." };
  }

  const trimmed = content.trim();
  if (!trimmed) {
    return { status: "error", message: "Draft content cannot be empty." };
  }

  const result = await createDraft(caseId, trimmed);
  if (result.error || !result.draft) {
    return { status: "error", message: result.error || "Could not save draft." };
  }

  revalidatePath(`/cases/${caseId}`);
  return { status: "success", draft: result.draft, message: "Draft saved successfully." };
}

export async function generateAndSaveDraftAction(
  caseId: number,
): Promise<DraftActionResult> {
  if (!Number.isInteger(caseId) || caseId <= 0) {
    return { status: "error", message: "Invalid case ID." };
  }

  const result = await generateAndSaveDraft(caseId);
  if (result.error || !result.draft) {
    return { status: "error", message: result.error || "Could not generate AI draft." };
  }

  revalidatePath(`/cases/${caseId}`);
  return {
    status: "success",
    draft: result.draft,
    message: result.draft.source === "Mock"
      ? "Demo draft generated (AI not configured). Saved to drafts."
      : "AI draft generated and saved to drafts.",
  };
}

export async function updateDraftAction(
  caseId: number,
  draftId: number,
  content: string,
  expectedVersion: number,
): Promise<DraftActionResult> {
  if (!Number.isInteger(caseId) || caseId <= 0) {
    return { status: "error", message: "Invalid case ID." };
  }

  const trimmed = content.trim();
  if (!trimmed) {
    return { status: "error", message: "Draft content cannot be empty." };
  }

  const result = await updateDraft(caseId, draftId, trimmed, expectedVersion);
  if (result.error || !result.draft) {
    return {
      status: "error",
      message: result.error || "Could not update draft.",
      conflict: result.conflict,
    };
  }

  revalidatePath(`/cases/${caseId}`);
  return {
    status: "success",
    draft: result.draft,
    message: result.draft.status === "Draft"
      ? "Draft updated (reverted to Draft status for review)."
      : "Draft updated successfully.",
  };
}

export async function approveDraftAction(
  caseId: number,
  draftId: number,
  approvedContent: string,
  expectedVersion: number,
): Promise<DraftActionResult> {
  if (!Number.isInteger(caseId) || caseId <= 0) {
    return { status: "error", message: "Invalid case ID." };
  }

  const result = await approveDraft(caseId, draftId, approvedContent, expectedVersion);
  if (result.error || !result.draft) {
    return {
      status: "error",
      message: result.error || "Could not approve draft.",
      conflict: result.conflict,
    };
  }

  revalidatePath(`/cases/${caseId}`);
  return {
    status: "success",
    draft: result.draft,
    message: "Draft approved. Approval applies strictly to the exact saved text (no message was sent).",
  };
}

export async function deleteDraftAction(
  caseId: number,
  draftId: number,
): Promise<{ status: "success"; message: string } | { status: "error"; message: string }> {
  if (!Number.isInteger(caseId) || caseId <= 0) {
    return { status: "error", message: "Invalid case ID." };
  }

  const result = await deleteDraft(caseId, draftId);
  if (!result.success) {
    return { status: "error", message: result.error || "Could not delete draft." };
  }

  revalidatePath(`/cases/${caseId}`);
  return { status: "success", message: "Draft deleted." };
}
