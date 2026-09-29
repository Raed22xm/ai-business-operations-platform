"use server";

import { revalidatePath } from "next/cache";
import {
  draftCaseResponse,
  generateCaseSummary,
  type AssistantResult,
} from "@/lib/assistant";
import { checkCaseEscalation, type EscalationCheckResult } from "@/lib/escalation";
import { createTask } from "@/lib/tasks";
import { isTaskPriority, type TaskPriority } from "@/lib/tasks-shared";

export async function checkCaseEscalationAction(caseId: number): Promise<EscalationCheckResult> {
  try {
    return await checkCaseEscalation(caseId);
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Could not perform escalation check.",
      retryable: true,
    };
  }
}


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

export type ScheduleFollowUpInput = {
  title: string;
  dueDate: string;
  description?: string | null;
  priority?: TaskPriority;
};

export type ScheduleFollowUpResult =
  | {
      status: "success";
      taskId: number;
      title: string;
      message: string;
    }
  | {
      status: "error";
      message: string;
      fieldErrors?: Partial<Record<"title" | "dueDate" | "description" | "priority", string>>;
    };

export async function scheduleFollowUpAction(
  caseId: number,
  input: ScheduleFollowUpInput,
): Promise<ScheduleFollowUpResult> {
  if (!Number.isInteger(caseId) || caseId <= 0) {
    return { status: "error", message: "Invalid case ID." };
  }

  const title = input.title?.trim() ?? "";
  if (!title) {
    return {
      status: "error",
      message: "Please enter a follow-up title.",
      fieldErrors: { title: "Follow-up title is required." },
    };
  }
  if (title.length > 200) {
    return {
      status: "error",
      message: "Title must be 200 characters or fewer.",
      fieldErrors: { title: "Title must be 200 characters or fewer." },
    };
  }

  const dueDate = input.dueDate?.trim() ?? "";
  if (!dueDate) {
    return {
      status: "error",
      message: "Please choose a due date.",
      fieldErrors: { dueDate: "Due date is required for a follow-up reminder." },
    };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
    return {
      status: "error",
      message: "Due date must be in YYYY-MM-DD format.",
      fieldErrors: { dueDate: "Due date must be in YYYY-MM-DD format." },
    };
  }

  const priority: TaskPriority = input.priority && isTaskPriority(input.priority)
    ? input.priority
    : "Normal";

  const description = input.description?.trim();
  const descVal = description && description.length > 0 ? description : null;

  const result = await createTask({
    caseId,
    title,
    description: descVal,
    dueDate,
    priority,
  });

  if (result.status === "error") {
    const errorMsg =
      result.formError ||
      Object.values(result.fieldErrors)[0] ||
      "Could not save follow-up task.";
    return {
      status: "error",
      message: errorMsg,
      fieldErrors: result.fieldErrors,
    };
  }

  // Refresh caches across overview dashboard, tasks workspace, and case details
  revalidatePath("/");
  revalidatePath("/tasks");
  revalidatePath(`/cases/${caseId}`);

  return {
    status: "success",
    taskId: result.taskId ?? 0,
    title,
    message: `Follow-up task “${title}” scheduled for ${dueDate}.`,
  };
}
