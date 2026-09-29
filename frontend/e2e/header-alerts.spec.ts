import {
  test,
  expect,
  createCustomerViaApi,
  createCaseViaApi,
  createTaskViaApi,
  deleteCaseViaApi,
  deleteCustomerViaApi,
  deleteTaskViaApi,
  uniqueMarker,
} from "./helpers";

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

test("header alerts: live badge, popover quick-filters, and 1-click overdue navigation", async ({
  page,
  request,
  e2e,
}) => {
  const marker = uniqueMarker("alert");
  const today = businessTodayIso();
  const overdueDate = shiftIsoDate(today, -2);

  let customerId = 0;
  let caseId = 0;
  const createdTasks: number[] = [];

  try {
    const customer = await createCustomerViaApi(request, e2e.apiURL, {
      name: `${marker} Alert Customer`,
      email: `${marker}@example.com`,
    });
    customerId = customer.id;

    const work = await createCaseViaApi(request, e2e.apiURL, {
      customerId: customer.id,
      title: `${marker} Urgent Case`,
    });
    caseId = work.id;

    // Create 1 overdue task and 1 task due today
    const overdueTask = await createTaskViaApi(request, e2e.apiURL, {
      caseId: work.id,
      title: `${marker} Overdue Task Item`,
      priority: "High",
      dueDate: overdueDate,
    });
    createdTasks.push(overdueTask.id);

    const todayTask = await createTaskViaApi(request, e2e.apiURL, {
      caseId: work.id,
      title: `${marker} Due Today Task Item`,
      priority: "Normal",
      dueDate: today,
    });
    createdTasks.push(todayTask.id);

    // Open workspace dashboard
    await page.goto(e2e.baseURL);

    // Locate the header alerts button
    const alertsTrigger = page.locator(".header-alerts-trigger");
    await expect(alertsTrigger).toBeVisible();

    // Verify badge exists and indicates urgent items
    const badge = alertsTrigger.locator(".alerts-badge");
    await expect(badge).toBeVisible();

    // Verify sidebar nav displays alert badge on Tasks link
    const sidebarTaskBadge = page.getByRole("link", { name: /Tasks/ }).locator(".nav-alert-badge");
    await expect(sidebarTaskBadge).toBeVisible();
    await expect(sidebarTaskBadge).toHaveText("1");

    // Click the header alerts trigger to open the popover
    await alertsTrigger.click();

    // Verify popover dialog is open
    const popover = page.locator(".alerts-popover");
    await expect(popover).toBeVisible();
    await expect(popover.getByText("Due-Date Alerts")).toBeVisible();

    // Verify Quick-Filter cards are visible
    const overdueFilterCard = popover.locator(".alerts-filter-card.is-overdue");
    await expect(overdueFilterCard).toBeVisible();
    const dueTodayFilterCard = popover.locator(".alerts-filter-card.is-today");
    await expect(dueTodayFilterCard).toBeVisible();

    // Verify our created tasks appear in the urgent list
    await expect(popover.getByText(`${marker} Overdue Task Item`)).toBeVisible();

    // Click the "Overdue" quick filter link
    await overdueFilterCard.click();

    // Verify navigation to /tasks?due=overdue
    await expect(page).toHaveURL(/tasks.*due=overdue/);

    // Verify the task table contains our overdue task
    await expect(page.getByRole("link", { name: `${marker} Overdue Task Item` })).toBeVisible();

    // Verify the due filter select is set to "overdue"
    const dueSelect = page.locator("select[name='due']");
    await expect(dueSelect).toHaveValue("overdue");
  } finally {
    for (const id of createdTasks) {
      await deleteTaskViaApi(request, e2e.apiURL, id);
    }
    if (caseId > 0) {
      await deleteCaseViaApi(request, e2e.apiURL, caseId);
    }
    if (customerId > 0) {
      await deleteCustomerViaApi(request, e2e.apiURL, customerId);
    }
  }
});
