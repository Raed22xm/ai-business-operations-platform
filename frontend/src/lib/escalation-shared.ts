export type EscalationFlag = {
  rule: "OverdueTask" | "HighPriorityTask" | "NoUnfinishedTasks" | string;
  reason: string;
  taskId: number | null;
  taskTitle: string | null;
  severity: "NeedsReview" | string;
};

export type CaseEscalationResult = {
  caseId: number;
  caseTitle: string;
  caseStatus: string;
  needsReview: boolean;
  summaryMessage: string;
  flags: EscalationFlag[];
};
