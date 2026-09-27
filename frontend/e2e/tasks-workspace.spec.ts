import { test, expect, createCustomerViaApi, createCaseViaApi, createTaskViaApi, deleteCaseViaApi, deleteCustomerViaApi, deleteTaskViaApi } from "./helpers";

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

test("tasks workspace filters, ordering, dashboard links, and access control", async ({ page, request, e2e }) => {
  const customers: number[] = [];
  const cases: number[] = [];
  const tasks: number[] = [];
  try {
    const marker = `tasks-ws-${Date.now()}`;
    const today = businessTodayIso();
    const overdueDate = shiftIsoDate(today, -2);
    const upcomingDate = shiftIsoDate(today, 3);

    const customer = await createCustomerViaApi(request, e2e.apiURL, {
      name: `${marker} Customer`,
      email: `${marker}@example.com`,
    });
    customers.push(customer.id);
    const work = await createCaseViaApi(request, e2e.apiURL, {
      customerId: customer.id,
      title: `${marker} Case`,
    });
    cases.push(work.id);

    const overdue = await createTaskViaApi(request, e2e.apiURL, {
      caseId: work.id,
      title: `${marker} overdue`,
      dueDate: overdueDate,
      priority: "Low",
    });
    tasks.push(overdue.id);
    const dueToday = await createTaskViaApi(request, e2e.apiURL, {
      caseId: work.id,
      title: `${marker} today`,
      dueDate: today,
      priority: "High",
    });
    tasks.push(dueToday.id);
    const upcoming = await createTaskViaApi(request, e2e.apiURL, {
      caseId: work.id,
      title: `${marker} upcoming`,
      dueDate: upcomingDate,
      priority: "Normal",
    });
    tasks.push(upcoming.id);
    const undated = await createTaskViaApi(request, e2e.apiURL, {
      caseId: work.id,
      title: `${marker} undated`,
      priority: "High",
    });
    tasks.push(undated.id);

    const anon = await request.get(`${e2e.apiURL}/api/tasks/search?page=1&pageSize=10`);
    expect(anon.status()).toBe(401);

    await page.goto(`${e2e.baseURL}/`);
    await page.locator(".metric-tile", { hasText: "Overdue tasks" }).click();
    await expect(page).toHaveURL(/\/tasks\?due=overdue/);
    await expect(page.getByRole("heading", { name: "Tasks" })).toBeVisible();
    await expect(page.getByRole("link", { name: `${marker} overdue`, exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: `${marker} today`, exact: true })).toHaveCount(0);

    await page.goto(`${e2e.baseURL}/tasks?customerId=${customer.id}&search=${encodeURIComponent(marker)}`);
    await expect(page.getByRole("navigation", { name: "Pagination" })).toBeVisible();
    const rows = page.locator("table tbody tr");
    await expect(rows).toHaveCount(4);
    await expect(rows.nth(0)).toContainText(`${marker} overdue`);
    await expect(rows.nth(1)).toContainText(`${marker} today`);
    await expect(rows.nth(2)).toContainText(`${marker} upcoming`);
    await expect(rows.nth(3)).toContainText(`${marker} undated`);

    await page.getByLabel("Due date").selectOption("today");
    await expect(page).toHaveURL(/due=today/);
    await expect(page).not.toHaveURL(/page=/);
    await expect(page.getByRole("link", { name: `${marker} today`, exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: `${marker} overdue`, exact: true })).toHaveCount(0);

    await page.getByLabel("Priority").selectOption("High");
    await expect(page).toHaveURL(/priority=High/);
    await expect(page).toHaveURL(/due=today/);
    await expect(page.getByRole("link", { name: `${marker} today`, exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: `${marker} undated`, exact: true })).toHaveCount(0);

    await page.getByLabel("Due date").selectOption("");
    await expect(page).not.toHaveURL(/due=/);
    await page.getByLabel("Priority").selectOption("");
    await expect(page).not.toHaveURL(/priority=/);
    await page.getByLabel("Sort by").selectOption("priority");
    await expect(page).toHaveURL(/sort=priority/);
    await expect(page).not.toHaveURL(/due=/);
    await expect(page).not.toHaveURL(/priority=/);
    await expect(page).not.toHaveURL(/page=/);
    const byPriority = page.locator("table tbody tr");
    await expect(byPriority).toHaveCount(4);
    await expect(byPriority.nth(0)).toContainText(`${marker} today`);
    await expect(byPriority.nth(1)).toContainText(`${marker} undated`);
    await expect(byPriority.nth(2)).toContainText(`${marker} upcoming`);
    await expect(byPriority.nth(3)).toContainText(`${marker} overdue`);
    await expect(byPriority.nth(0).locator(".task-priority-label")).toHaveAttribute(
      "data-priority",
      "High",
    );

    await page.getByRole("link", { name: `${marker} today`, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/cases/${work.id}`));
    await page.goBack();
    await expect(page).toHaveURL(/sort=priority/);
    await expect(page.getByRole("heading", { name: "Tasks" })).toBeVisible();

    await page.setViewportSize({ width: 390, height: 860 });
    await expect(page.locator(".crm-table-scroll")).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
    ).toBeTruthy();

    await page.getByRole("button", { name: "Open navigation" }).click();
    await page.getByRole("dialog").getByRole("link", { name: "Tasks" }).click();
    await expect(page.getByRole("heading", { name: "Tasks" })).toBeVisible();
  } finally {
    for (const id of tasks) await deleteTaskViaApi(request, e2e.apiURL, id);
    for (const id of cases) await deleteCaseViaApi(request, e2e.apiURL, id);
    for (const id of customers) await deleteCustomerViaApi(request, e2e.apiURL, id);
  }
});
