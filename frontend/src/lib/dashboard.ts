export type DashboardSummary = {
  totalCustomers: number;
  totalCases: number;
  openCases: number;
  inProgressCases: number;
  closedCases: number;
};

export async function getDashboardSummary(): Promise<DashboardSummary> {
  let response: Response;
  try {
    response = await fetch(dashboardSummaryUrl(), {
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
    isNonNegativeInt(row.closedCases)
  );
}

function isNonNegativeInt(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}
