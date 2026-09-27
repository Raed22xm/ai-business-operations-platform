import { test, expect, createCustomerViaApi, createCaseViaApi, createTaskViaApi, deleteCaseViaApi, deleteCustomerViaApi, deleteTaskViaApi, bearerHeaders } from "./helpers";

function businessTodayIso(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Copenhagen",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const year = parts.find((part) => part.type === "year")?.value ?? "2026";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";
  return `${year}-${month}-${day}`;
}

function shiftIsoDate(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const utc = Date.UTC(y, m - 1, d + days);
  const date = new Date(utc);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

test("dashboard shows overdue and due-today task visibility", async ({ page, request, e2e }) => {
  const customers: number[] = [];
  const cases: number[] = [];
  const tasks: number[] = [];
  try {
    const today = businessTodayIso();
    const yesterday = shiftIsoDate(today, -1);
    const tomorrow = shiftIsoDate(today, 1);

    const customer = await createCustomerViaApi(request, e2e.apiURL, {
      name: "Due Date Visibility",
      email: `due.visibility.${Date.now()}@example.com`,
    });
    customers.push(customer.id);
    const work = await createCaseViaApi(request, e2e.apiURL, {
      customerId: customer.id,
      title: "Due date visibility case",
    });
    cases.push(work.id);

    const overdue = await createTaskViaApi(request, e2e.apiURL, {
      caseId: work.id,
      title: "Overdue follow-up",
      dueDate: yesterday,
    });
    tasks.push(overdue.id);
    const dueToday = await createTaskViaApi(request, e2e.apiURL, {
      caseId: work.id,
      title: "Due today call",
      dueDate: today,
    });
    tasks.push(dueToday.id);
    const upcoming = await createTaskViaApi(request, e2e.apiURL, {
      caseId: work.id,
      title: "Tomorrow prep",
      dueDate: tomorrow,
    });
    tasks.push(upcoming.id);
    const doneOverdue = await createTaskViaApi(request, e2e.apiURL, {
      caseId: work.id,
      title: "Completed late item",
      dueDate: yesterday,
    });
    tasks.push(doneOverdue.id);
    await request.put(`${e2e.apiURL}/api/tasks/${doneOverdue.id}`, {
      headers: bearerHeaders(e2e),
      data: {
        title: "Completed late item",
        description: null,
        dueDate: yesterday,
        status: "Done",
      },
    });

    await page.setViewportSize({ width: 1440, height: 960 });
    await page.goto(`${e2e.baseURL}/?customerId=${customer.id}&caseId=${work.id}`);

    const kpis = page.locator("#business-kpis");
    await expect(kpis.locator(".metric-tile", { hasText: "Overdue tasks" })).toBeVisible();
    await expect(kpis.locator(".metric-tile", { hasText: "Due today" })).toBeVisible();
    await expect(kpis.getByRole("heading", { name: "Outstanding tasks" })).toBeVisible();
    await expect(kpis.getByRole("link", { name: /Overdue follow-up/ })).toBeVisible();
    await expect(kpis.locator(".task-overdue-label").first()).toBeVisible();

    await page.goto(`${e2e.baseURL}/cases/${work.id}`);
    const overdueRow = page.getByRole("row", { name: /Overdue follow-up/ });
    await expect(overdueRow.getByText("Overdue", { exact: true })).toBeVisible();
    await expect(page.getByRole("row", { name: /Due today call/ }).getByText("Overdue")).toHaveCount(0);
    await expect(page.getByRole("row", { name: /Tomorrow prep/ }).getByText("Overdue")).toHaveCount(0);
    await expect(page.getByRole("row", { name: /Completed late item/ }).getByText("Overdue")).toHaveCount(0);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${e2e.baseURL}/?customerId=${customer.id}&caseId=${work.id}`);
    await expect(kpis.getByRole("heading", { name: "Outstanding tasks" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBeTruthy();
  } finally {
    for (const id of tasks) await deleteTaskViaApi(request, e2e.apiURL, id);
    for (const id of cases) await deleteCaseViaApi(request, e2e.apiURL, id);
    for (const id of customers) await deleteCustomerViaApi(request, e2e.apiURL, id);
  }
});
