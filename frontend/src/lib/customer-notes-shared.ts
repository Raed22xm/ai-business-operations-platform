export type CustomerNote = {
  id: number;
  customerId: number;
  content: string;
  authorName: string;
  createdAt: string;
  updatedAt: string | null;
};

export type PagedCustomerNotes = {
  items: CustomerNote[];
  page: number;
  pageSize: number;
  totalCount: number;
};

export const CUSTOMER_NOTES_PAGE_SIZE = 10;
export const CUSTOMER_NOTE_MAX_LENGTH = 5000;

export function notePreviewLabel(content: string): string {
  const trimmed = content.trim().replace(/\s+/g, " ");
  if (trimmed.length === 0) {
    return "note";
  }
  if (trimmed.length <= 40) {
    return trimmed;
  }
  return `${trimmed.slice(0, 40)}…`;
}

export function formatNoteTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return `${new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(date)} UTC`;
}
