export type TaskStatus = "Todo" | "InProgress" | "Done";

export type TaskPriority = "Low" | "Normal" | "High";

export type CaseTask = {
  id: number;
  caseId: number;
  title: string;
  description: string | null;
  dueDate: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  createdAt: string;
};

/** Default business calendar for overdue / due-today (matches API BusinessTimezone). */
export const DEFAULT_BUSINESS_TIMEZONE = "Europe/Copenhagen";

export function taskStatusLabel(status: TaskStatus): string {
  if (status === "Todo") {
    return "To do";
  }
  if (status === "InProgress") {
    return "In progress";
  }
  return "Done";
}

export function taskPriorityLabel(priority: TaskPriority): string {
  return priority;
}

export function isTaskPriority(value: string | null | undefined): value is TaskPriority {
  return value === "Low" || value === "Normal" || value === "High";
}

/** Display date-only values without timezone conversion. */
export function formatTaskDueDate(value: string | null): string {
  if (!value) {
    return "—";
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

/**
 * Calendar "today" (YYYY-MM-DD) in the business time zone.
 * Due dates stay date-only; this only decides which calendar day is "today".
 */
export function businessToday(
  timeZone: string = process.env.NEXT_PUBLIC_BUSINESS_TIMEZONE?.trim() ||
    DEFAULT_BUSINESS_TIMEZONE,
  now: Date = new Date(),
): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  if (!year || !month || !day) {
    return now.toISOString().slice(0, 10);
  }
  return `${year}-${month}-${day}`;
}

/**
 * Overdue when due date is before today and status is not Done.
 * Tasks due today are not overdue. Missing due dates are never overdue.
 */
export function isTaskOverdue(
  dueDate: string | null,
  status: TaskStatus,
  today: string = businessToday(),
): boolean {
  if (!dueDate || status === "Done") {
    return false;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate) || !/^\d{4}-\d{2}-\d{2}$/.test(today)) {
    return false;
  }
  return dueDate < today;
}

export function isTaskDueToday(
  dueDate: string | null,
  status: TaskStatus,
  today: string = businessToday(),
): boolean {
  if (!dueDate || status === "Done") {
    return false;
  }
  return dueDate === today;
}
