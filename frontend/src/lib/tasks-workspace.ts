import "server-only";
import { apiFetch } from "@/lib/api";
import type { TaskPriority, TaskStatus } from "@/lib/tasks-shared";
import {
  TASKS_PAGE_SIZE,
  type TaskDueFilter,
  type TaskSearchItem,
  type TaskSort,
} from "@/lib/tasks-workspace-shared";

export type { TaskDueFilter, TaskSearchItem, TaskSort } from "@/lib/tasks-workspace-shared";
export {
  TASKS_PAGE_SIZE,
  tasksPageHref,
  isTaskDueFilter,
  isTaskPriority,
  isTaskSort,
} from "@/lib/tasks-workspace-shared";

export type PagedTasks = {
  items: TaskSearchItem[];
  page: number;
  pageSize: number;
  totalCount: number;
};

export async function getTasksPage(options?: {
  search?: string;
  customerId?: number;
  caseId?: number;
  status?: TaskStatus;
  priority?: TaskPriority;
  due?: TaskDueFilter;
  sort?: TaskSort;
  page?: number;
  pageSize?: number;
}): Promise<PagedTasks> {
  const url = new URL(`${tasksSearchUrl()}`);
  const search = options?.search?.trim();
  if (search) {
    url.searchParams.set("search", search);
  }
  if (options?.customerId !== undefined) {
    url.searchParams.set("customerId", String(options.customerId));
  }
  if (options?.caseId !== undefined) {
    url.searchParams.set("caseId", String(options.caseId));
  }
  if (options?.status !== undefined) {
    url.searchParams.set("status", options.status);
  }
  if (options?.priority !== undefined) {
    url.searchParams.set("priority", options.priority);
  }
  if (options?.due !== undefined) {
    url.searchParams.set("due", options.due);
  }
  if (options?.sort !== undefined) {
    url.searchParams.set("sort", options.sort);
  }
  url.searchParams.set("page", String(options?.page ?? 1));
  url.searchParams.set("pageSize", String(options?.pageSize ?? TASKS_PAGE_SIZE));

  let response: Response;
  try {
    response = await apiFetch(url, {
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
  if (!isPagedTasks(body)) {
    throw new Error("Task page had an unexpected shape.");
  }

  return body;
}

function tasksSearchUrl(): string {
  const baseUrl = process.env.API_BASE_URL?.trim();
  if (!baseUrl) {
    throw new Error(
      "Missing API_BASE_URL. Set it in frontend/.env.local, for example http://localhost:5222.",
    );
  }

  return `${baseUrl.replace(/\/$/, "")}/api/tasks/search`;
}

function isPagedTasks(value: unknown): value is PagedTasks {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const row = value as Record<string, unknown>;
  return (
    Array.isArray(row.items) &&
    row.items.every(isTaskSearchItem) &&
    typeof row.page === "number" &&
    Number.isInteger(row.page) &&
    row.page >= 1 &&
    typeof row.pageSize === "number" &&
    Number.isInteger(row.pageSize) &&
    row.pageSize >= 1 &&
    typeof row.totalCount === "number" &&
    Number.isInteger(row.totalCount) &&
    row.totalCount >= 0
  );
}

function isTaskSearchItem(value: unknown): value is TaskSearchItem {
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
    typeof row.caseTitle === "string" &&
    typeof row.customerId === "number" &&
    Number.isInteger(row.customerId) &&
    row.customerId > 0 &&
    typeof row.customerName === "string" &&
    typeof row.title === "string" &&
    (row.dueDate === null || typeof row.dueDate === "string") &&
    (row.status === "Todo" || row.status === "InProgress" || row.status === "Done") &&
    (row.priority === "Low" || row.priority === "Normal" || row.priority === "High") &&
    typeof row.isOverdue === "boolean" &&
    typeof row.isDueToday === "boolean"
  );
}
