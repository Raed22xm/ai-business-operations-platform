"use server";

import { getAccessToken } from "@/lib/auth";
import { getDashboardSummary } from "@/lib/dashboard";

export type UrgentAlertItem = {
  id: number;
  caseId: number;
  caseTitle: string;
  title: string;
  dueDate: string | null;
  priority: string;
  isOverdue: boolean;
  isDueToday: boolean;
};

export type UrgentTasksAlertData = {
  overdueTasks: number;
  dueTodayTasks: number;
  urgentCount: number;
  items: UrgentAlertItem[];
};

export async function getUrgentTasksAlertAction(): Promise<UrgentTasksAlertData | null> {
  try {
    const token = await getAccessToken();
    if (!token) {
      return null;
    }

    const summary = await getDashboardSummary();
    const overdueTasks = summary.overdueTasks;
    const dueTodayTasks = summary.dueTodayTasks;
    const urgentCount = overdueTasks + dueTodayTasks;

    const items: UrgentAlertItem[] = summary.outstandingTasks
      .filter((task) => task.isOverdue || task.isDueToday)
      .slice(0, 5)
      .map((t) => ({
        id: t.id,
        caseId: t.caseId,
        caseTitle: t.caseTitle,
        title: t.title,
        dueDate: t.dueDate,
        priority: t.priority,
        isOverdue: t.isOverdue,
        isDueToday: t.isDueToday,
      }));

    return {
      overdueTasks,
      dueTodayTasks,
      urgentCount,
      items,
    };
  } catch {
    return null;
  }
}
