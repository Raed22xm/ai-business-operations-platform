export type ResponseDraftStatus = "Draft" | "Approved";
export type ResponseDraftSource = "Ai" | "Mock" | "Manual";

export type ResponseDraft = {
  id: number;
  caseId: number;
  content: string;
  source: ResponseDraftSource;
  status: ResponseDraftStatus;
  createdBy: string;
  createdAt: string;
  updatedAt: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  version: number;
};

export const DRAFT_MAX_LENGTH = 10000;

export function isResponseDraftStatus(value: unknown): value is ResponseDraftStatus {
  return value === "Draft" || value === "Approved";
}

export function isResponseDraftSource(value: unknown): value is ResponseDraftSource {
  return value === "Ai" || value === "Mock" || value === "Manual";
}

export function isResponseDraft(value: unknown): value is ResponseDraft {
  if (!value || typeof value !== "object") {
    return false;
  }
  const row = value as Record<string, unknown>;
  return (
    typeof row.id === "number" &&
    typeof row.caseId === "number" &&
    typeof row.content === "string" &&
    typeof row.source === "string" &&
    isResponseDraftSource(row.source) &&
    typeof row.status === "string" &&
    isResponseDraftStatus(row.status) &&
    typeof row.createdBy === "string" &&
    typeof row.createdAt === "string" &&
    (row.updatedAt === null || typeof row.updatedAt === "string") &&
    (row.approvedBy === null || typeof row.approvedBy === "string") &&
    (row.approvedAt === null || typeof row.approvedAt === "string") &&
    typeof row.version === "number"
  );
}

export function draftStatusLabel(status: ResponseDraftStatus): string {
  switch (status) {
    case "Draft":
      return "Draft";
    case "Approved":
      return "Approved";
  }
}

export function draftSourceLabel(source: ResponseDraftSource): string {
  switch (source) {
    case "Ai":
      return "AI Generated";
    case "Mock":
      return "Mock Generated (Demo)";
    case "Manual":
      return "Manual Draft";
  }
}

export function formatDraftDate(utcDateStr: string | null | undefined): string {
  if (!utcDateStr) {
    return "—";
  }
  const date = new Date(utcDateStr);
  if (Number.isNaN(date.getTime())) {
    return utcDateStr;
  }
  return `${new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(date)} UTC`;
}
