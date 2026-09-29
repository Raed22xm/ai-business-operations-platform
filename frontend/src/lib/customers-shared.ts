export type Customer = {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  company: string | null;
  createdAt: string;
};

export function customersPageHref(
  search: string | null,
  page: number | null = null,
  fromDate: string | null = null,
  toDate: string | null = null,
): string {
  const params = new URLSearchParams();
  const trimmed = search?.trim() ?? "";
  if (trimmed !== "") {
    params.set("search", trimmed);
  }
  const from = fromDate?.trim() ?? "";
  if (from !== "") {
    params.set("fromDate", from);
  }
  const to = toDate?.trim() ?? "";
  if (to !== "") {
    params.set("toDate", to);
  }
  if (page !== null && page > 1) {
    params.set("page", String(page));
  }

  const query = params.toString();
  return query === "" ? "/customers" : `/customers?${query}`;
}

export function customersExportHref(
  search: string | null,
  fromDate: string | null = null,
  toDate: string | null = null,
): string {
  const params = new URLSearchParams();
  const trimmed = search?.trim() ?? "";
  if (trimmed !== "") {
    params.set("search", trimmed);
  }
  const from = fromDate?.trim() ?? "";
  if (from !== "") {
    params.set("fromDate", from);
  }
  const to = toDate?.trim() ?? "";
  if (to !== "") {
    params.set("toDate", to);
  }

  const query = params.toString();
  return query === "" ? "/customers/export" : `/customers/export?${query}`;
}

export function customerDetailsHref(
  id: number,
  search: string | null = null,
  page: number | null = null,
): string {
  const params = new URLSearchParams();
  const trimmed = search?.trim() ?? "";
  if (trimmed !== "") {
    params.set("search", trimmed);
  }
  if (page !== null && page > 1) {
    params.set("page", String(page));
  }

  const query = params.toString();
  return query === "" ? `/customers/${id}` : `/customers/${id}?${query}`;
}

export function formatCustomerCreatedAt(value: string): string {
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
