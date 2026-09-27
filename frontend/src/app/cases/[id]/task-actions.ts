"use server";

import { revalidatePath } from "next/cache";
import type { DeleteTaskState, TaskFormState } from "@/lib/task-form-state";
import {
  createTask,
  deleteTask,
  updateTask,
  type TaskStatus,
} from "@/lib/tasks";

export async function createTaskAction(
  caseId: number,
  previous: TaskFormState,
  formData: FormData,
): Promise<TaskFormState> {
  if (!Number.isInteger(caseId) || caseId <= 0) {
    return {
      status: "error",
      message: null,
      formError: "Could not save the task.",
      fieldErrors: {},
      revision: previous.revision,
      taskId: null,
    };
  }

  const description = text(formData, "description").trim();
  const dueDate = text(formData, "dueDate").trim();
  const result = await createTask({
    caseId,
    title: text(formData, "title").trim(),
    description: description === "" ? null : description,
    dueDate: dueDate === "" ? null : dueDate,
  });

  if (result.status === "success") {
    revalidatePath(`/cases/${caseId}`);
  }

  return {
    ...result,
    revision: result.status === "success" ? previous.revision + 1 : previous.revision,
  };
}

export async function updateTaskAction(
  caseId: number,
  taskId: number,
  previous: TaskFormState,
  formData: FormData,
): Promise<TaskFormState> {
  const status = readStatus(text(formData, "status"));
  if (!status) {
    return {
      status: "error",
      message: null,
      formError: null,
      fieldErrors: { status: "Status must be Todo, InProgress, or Done." },
      revision: previous.revision,
      taskId,
    };
  }

  const description = text(formData, "description").trim();
  const dueDate = text(formData, "dueDate").trim();
  const result = await updateTask(taskId, {
    title: text(formData, "title").trim(),
    description: description === "" ? null : description,
    dueDate: dueDate === "" ? null : dueDate,
    status,
  });

  if (result.status === "success") {
    revalidatePath(`/cases/${caseId}`);
  }

  return {
    ...result,
    revision: result.status === "success" ? previous.revision + 1 : previous.revision,
  };
}

export async function deleteTaskAction(
  caseId: number,
  _previous: DeleteTaskState,
  formData: FormData,
): Promise<DeleteTaskState> {
  const id = Number(formData.get("id"));
  const title = text(formData, "title").trim();

  if (!Number.isInteger(id) || id <= 0 || title === "") {
    return {
      status: "error",
      message: null,
      formError: "Could not delete the task.",
      taskId: Number.isInteger(id) ? id : null,
    };
  }

  const result = await deleteTask(id, title);

  if (result.status === "success") {
    revalidatePath(`/cases/${caseId}`);
  }

  return result;
}

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function readStatus(value: string): TaskStatus | null {
  if (value === "Todo" || value === "InProgress" || value === "Done") {
    return value;
  }
  return null;
}
