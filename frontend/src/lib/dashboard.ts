import "server-only";
import { apiFetch } from "@/lib/api";
import type { TaskPriority } from "@/lib/tasks-shared";

export type OutstandingTask = {
  id: number;
  caseId: number;
  caseTitle: string;
  title: string;
  dueDate: string | null;
  status: "Todo" | "InProgress" | "Done";
  priority: TaskPriority;
  isOverdue: boolean;
  isDueToday: boolean;
};

export type DashboardSummary = {
  totalCustomers: number;
  totalCases: number;
  openCases: number;
  inProgressCases: number;
  closedCases: number;
  overdueTasks: number;
  dueTodayTasks: number;
  outstandingTasks: OutstandingTask[];
  businessTimeZone: string;
  businessToday: string;
};

export async function getDashboardSummary(): Promise<DashboardSummary> {
  let response: Response;
  try {
    response = await apiFetch(dashboardSummaryUrl(), {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
  } catch {
    throw new Error("Could not load the dashboard. Check that the API is running.");
  }

  if (!response.ok) {
    throw new Error(`Could not load the dashboard (${response.status}).`);
  }

  const body: unknown = await response.json();
  if (!isDashboardSummary(body)) {
    throw new Error("Dashboard summary had an unexpected shape.");
  }

  return body;
}

function dashboardSummaryUrl(): string {
  const baseUrl = process.env.API_BASE_URL?.trim();

  if (!baseUrl) {
    throw new Error(
      "Missing API_BASE_URL. Set it in frontend/.env.local, for example http://localhost:5222.",
    );
  }

  return `${baseUrl.replace(/\/$/, "")}/api/dashboard/summary`;
}

function isDashboardSummary(value: unknown): value is DashboardSummary {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const row = value as Record<string, unknown>;

  return (
    isNonNegativeInt(row.totalCustomers) &&
    isNonNegativeInt(row.totalCases) &&
    isNonNegativeInt(row.openCases) &&
    isNonNegativeInt(row.inProgressCases) &&
    isNonNegativeInt(row.closedCases) &&
    isNonNegativeInt(row.overdueTasks) &&
    isNonNegativeInt(row.dueTodayTasks) &&
    Array.isArray(row.outstandingTasks) &&
    row.outstandingTasks.every(isOutstandingTask) &&
    typeof row.businessTimeZone === "string" &&
    typeof row.businessToday === "string"
  );
}

function isOutstandingTask(value: unknown): value is OutstandingTask {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const row = value as Record<string, unknown>;
  return (
    isNonNegativeInt(row.id) &&
    row.id > 0 &&
    isNonNegativeInt(row.caseId) &&
    row.caseId > 0 &&
    typeof row.caseTitle === "string" &&
    typeof row.title === "string" &&
    (row.dueDate === null || typeof row.dueDate === "string") &&
    (row.status === "Todo" || row.status === "InProgress" || row.status === "Done") &&
    (row.priority === "Low" || row.priority === "Normal" || row.priority === "High") &&
    typeof row.isOverdue === "boolean" &&
    typeof row.isDueToday === "boolean"
  );
}

function isNonNegativeInt(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}
