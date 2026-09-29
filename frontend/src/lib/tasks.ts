import "server-only";
import { apiFetch } from "@/lib/api";
import type { DeleteTaskState, TaskField, TaskFormState } from "@/lib/task-form-state";
import {
  taskStatusLabel,
  type CaseTask,
  type TaskPriority,
  type TaskStatus,
} from "@/lib/tasks-shared";

export type { CaseTask, TaskPriority, TaskStatus } from "@/lib/tasks-shared";
export {
  formatTaskDueDate,
  isTaskDueToday,
  isTaskOverdue,
  isTaskPriority,
  taskPriorityLabel,
  taskStatusLabel,
} from "@/lib/tasks-shared";

export type NewTask = {
  caseId: number;
  title: string;
  description: string | null;
  dueDate: string | null;
  priority: TaskPriority;
};

export type TaskChanges = {
  title: string;
  description: string | null;
  dueDate: string | null;
  status: TaskStatus;
  priority: TaskPriority;
};

export async function getTasksForCase(caseId: number): Promise<CaseTask[]> {
  if (!Number.isInteger(caseId) || caseId <= 0) {
    return [];
  }

  let response: Response;
  try {
    response = await apiFetch(`${tasksUrl()}?caseId=${caseId}`, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
  } catch {
    throw new Error("Could not load tasks. Check that the API is running.");
  }

  if (!response.ok) {
    throw new Error(`Could not load tasks (${response.status}).`);
  }

  const body: unknown = await response.json();
  if (!Array.isArray(body) || !body.every(isCaseTask)) {
    throw new Error("The API returned unexpected tasks.");
  }

  return body;
}

export async function createTask(input: NewTask): Promise<TaskFormState> {
  let response: Response;

  try {
    response = await apiFetch(tasksUrl(), {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
      cache: "no-store",
    });
  } catch {
    return taskError("Could not save the task. Check that the API is running.");
  }

  if (response.status === 201) {
    const body: unknown = await response.json();
    if (!isCaseTask(body)) {
      return taskError("The API returned an unexpected task.");
    }

    return {
      status: "success",
      message: `${body.title} was added.`,
      formError: null,
      fieldErrors: {},
      revision: 0,
      taskId: body.id,
    };
  }

  if (response.status === 400) {
    const fieldErrors = await readFieldErrors(response);
    return {
      status: "error",
      message: null,
      formError: Object.keys(fieldErrors).length === 0 ? "Could not save the task." : null,
      fieldErrors,
      revision: 0,
      taskId: null,
    };
  }

  if (response.status === 409) {
    const problem: unknown = await response.json().catch(() => null);
    const detail =
      typeof problem === "object" &&
      problem !== null &&
      "detail" in problem &&
      typeof (problem as { detail: unknown }).detail === "string"
        ? (problem as { detail: string }).detail
        : "This case is archived and cannot be changed. Restore it first.";
    return {
      status: "error",
      message: null,
      formError: detail,
      fieldErrors: {},
      revision: 0,
      taskId: null,
    };
  }

  return taskError(`Could not save the task (${response.status}).`);
}

export async function updateTask(id: number, input: TaskChanges): Promise<TaskFormState> {
  let response: Response;

  try {
    response = await apiFetch(`${tasksUrl()}/${id}`, {
      method: "PUT",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
      cache: "no-store",
    });
  } catch {
    return taskError("Could not save the task. Check that the API is running.");
  }

  if (response.status === 200) {
    const body: unknown = await response.json();
    if (!isCaseTask(body)) {
      return taskError("The API returned an unexpected task.");
    }

    return {
      status: "success",
      message: `${body.title} was updated.`,
      formError: null,
      fieldErrors: {},
      revision: 0,
      taskId: body.id,
    };
  }

  if (response.status === 400) {
    const fieldErrors = await readFieldErrors(response);
    return {
      status: "error",
      message: null,
      formError: Object.keys(fieldErrors).length === 0 ? "Could not save the task." : null,
      fieldErrors,
      revision: 0,
      taskId: id,
    };
  }

  if (response.status === 404) {
    return taskError("That task was not found.", id);
  }

  return taskError(`Could not save the task (${response.status}).`, id);
}

export async function updateTaskStatus(id: number, status: TaskStatus): Promise<TaskFormState> {
  let response: Response;

  try {
    response = await apiFetch(`${tasksUrl()}/${id}/status`, {
      method: "PATCH",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ status }),
      cache: "no-store",
    });
  } catch {
    return taskError("Could not update task status. Check that the API is running.", id);
  }

  if (response.status === 200) {
    const body: unknown = await response.json();
    if (!isCaseTask(body)) {
      return taskError("The API returned an unexpected task.", id);
    }

    return {
      status: "success",
      message: `${body.title} status updated to ${taskStatusLabel(body.status)}.`,
      formError: null,
      fieldErrors: {},
      revision: 0,
      taskId: body.id,
    };
  }

  if (response.status === 400) {
    return taskError("Invalid task status.", id);
  }

  if (response.status === 404) {
    return taskError("That task was not found.", id);
  }

  if (response.status === 409) {
    return taskError("Archived cases are read-only.", id);
  }

  return taskError(`Could not update status (${response.status}).`, id);
}

export async function deleteTask(id: number, title: string): Promise<DeleteTaskState> {
  let response: Response;

  try {
    response = await apiFetch(`${tasksUrl()}/${id}`, {
      method: "DELETE",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
  } catch {
    return deleteTaskError(id, "Could not delete the task. Check that the API is running.");
  }

  if (response.status === 204) {
    return {
      status: "success",
      message: `${title} was deleted.`,
      formError: null,
      taskId: id,
    };
  }

  if (response.status === 404) {
    return deleteTaskError(id, "That task was not found.");
  }

  return deleteTaskError(id, `Could not delete the task (${response.status}).`);
}

function tasksUrl(): string {
  const baseUrl = process.env.API_BASE_URL?.trim();

  if (!baseUrl) {
    throw new Error(
      "Missing API_BASE_URL. Set it in frontend/.env.local, for example http://localhost:5222.",
    );
  }

  return `${baseUrl.replace(/\/$/, "")}/api/tasks`;
}

function isCaseTask(value: unknown): value is CaseTask {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const row = value as Record<string, unknown>;
  return (
    typeof row.id === "number" &&
    Number.isInteger(row.id) &&
    row.id > 0 &&
    typeof row.caseId === "number" &&
    Number.isInteger(row.caseId) &&
    row.caseId > 0 &&
    typeof row.title === "string" &&
    (row.description === null || typeof row.description === "string") &&
    (row.dueDate === null || typeof row.dueDate === "string") &&
    (row.status === "Todo" || row.status === "InProgress" || row.status === "Done") &&
    (row.priority === "Low" || row.priority === "Normal" || row.priority === "High") &&
    typeof row.createdAt === "string"
  );
}

async function readFieldErrors(response: Response): Promise<Partial<Record<TaskField, string>>> {
  try {
    const body: unknown = await response.json();
    if (typeof body !== "object" || body === null) {
      return {};
    }

    const errors = (body as { errors?: unknown }).errors;
    if (typeof errors !== "object" || errors === null) {
      return {};
    }

    const fieldErrors: Partial<Record<TaskField, string>> = {};
    for (const field of ["title", "description", "dueDate", "status", "priority", "caseId"] as const) {
      const messages = (errors as Record<string, unknown>)[field];
      if (Array.isArray(messages) && typeof messages[0] === "string") {
        const key = field === "caseId" ? "title" : field;
        if (
          key === "title" ||
          key === "description" ||
          key === "dueDate" ||
          key === "status" ||
          key === "priority"
        ) {
          fieldErrors[key] = messages[0];
        }
      }
    }
    return fieldErrors;
  } catch {
    return {};
  }
}

function taskError(formError: string, taskId: number | null = null): TaskFormState {
  return {
    status: "error",
    message: null,
    formError,
    fieldErrors: {},
    revision: 0,
    taskId,
  };
}

function deleteTaskError(taskId: number, formError: string): DeleteTaskState {
  return {
    status: "error",
    message: null,
    formError,
    taskId,
  };
}
