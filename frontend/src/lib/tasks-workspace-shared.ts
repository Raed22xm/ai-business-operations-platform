import type { TaskPriority, TaskStatus } from "@/lib/tasks-shared";
import { isTaskPriority } from "@/lib/tasks-shared";

export type TaskDueFilter = "overdue" | "today" | "upcoming" | "none";
export type TaskSort = "due" | "priority";

export type TaskSearchItem = {
  id: number;
  caseId: number;
  caseTitle: string;
  customerId: number;
  customerName: string;
  title: string;
  dueDate: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  isOverdue: boolean;
  isDueToday: boolean;
};

export type TaskListFilters = {
  search: string | null;
  customerId: number | null;
  caseId: number | null;
  status: TaskStatus | null;
  priority: TaskPriority | null;
  due: TaskDueFilter | null;
  sort: TaskSort | null;
  page: number | null;
};

export const TASKS_PAGE_SIZE = 20;

export function tasksPageHref(filters: Partial<TaskListFilters> = {}): string {
  const params = new URLSearchParams();
  const trimmed = filters.search?.trim() ?? "";
  if (trimmed !== "") {
    params.set("search", trimmed);
  }
  if (filters.customerId != null) {
    params.set("customerId", String(filters.customerId));
  }
  if (filters.caseId != null) {
    params.set("caseId", String(filters.caseId));
  }
  if (filters.status) {
    params.set("status", filters.status);
  }
  if (filters.priority) {
    params.set("priority", filters.priority);
  }
  if (filters.due) {
    params.set("due", filters.due);
  }
  if (filters.sort && filters.sort !== "due") {
    params.set("sort", filters.sort);
  }
  if (filters.page != null && filters.page > 1) {
    params.set("page", String(filters.page));
  }

  const query = params.toString();
  return query === "" ? "/tasks" : `/tasks?${query}`;
}

export function isTaskDueFilter(value: string | null | undefined): value is TaskDueFilter {
  return value === "overdue" || value === "today" || value === "upcoming" || value === "none";
}

export function isTaskSort(value: string | null | undefined): value is TaskSort {
  return value === "due" || value === "priority";
}

export { isTaskPriority };
