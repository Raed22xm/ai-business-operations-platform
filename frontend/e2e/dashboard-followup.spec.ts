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

test("schedule follow-up: disabled states for no case and archived case", async ({ page, request, e2e }) => {
  const customers: number[] = [];
  const cases: number[] = [];
  try {
    const emptyCustomer = await createCustomerViaApi(request, e2e.apiURL, {
      name: "Empty Customer",
      email: `empty.customer.${Date.now()}@example.com`,
    });
    customers.push(emptyCustomer.id);

    const customer = await createCustomerViaApi(request, e2e.apiURL, {
      name: "Archived Customer",
      email: `archived.customer.${Date.now()}@example.com`,
    });
    customers.push(customer.id);
    const work = await createCaseViaApi(request, e2e.apiURL, {
      customerId: customer.id,
      title: "Archived case check",
    });
    cases.push(work.id);

    // 1. Visit dashboard with customer who has no cases
    await page.goto(`${e2e.baseURL}/?customerId=${emptyCustomer.id}`);
    const noCaseFollowUpBtn = page.getByRole("button", { name: /Schedule follow-up/i });
    await expect(noCaseFollowUpBtn).toBeDisabled();
    await expect(page.getByText("Select case").first()).toBeVisible();

    // 2. Close and archive the case via API
    const closeRes = await request.put(`${e2e.apiURL}/api/cases/${work.id}`, {
      headers: bearerHeaders(e2e),
      data: {
        title: work.title,
        description: null,
        status: "Closed",
      },
    });
    expect(closeRes.ok()).toBeTruthy();

    const archiveRes = await request.post(`${e2e.apiURL}/api/cases/${work.id}/archive`, {
      headers: bearerHeaders(e2e),
    });
    expect(archiveRes.ok()).toBeTruthy();

    // 3. Visit dashboard with the archived case selected
    await page.goto(`${e2e.baseURL}/?customerId=${customer.id}&caseId=${work.id}`);
    const archivedFollowUpBtn = page.getByRole("button", { name: /Schedule follow-up/i });
    await expect(archivedFollowUpBtn).toBeDisabled();
    await expect(archivedFollowUpBtn).toHaveAttribute("title", "Follow-ups cannot be scheduled for archived cases");
    await expect(page.getByText("Archived case").first()).toBeVisible();
    await expect(page.getByText(/This case is archived\. Restore it to schedule follow-ups/i)).toBeVisible();
  } finally {
    for (const id of cases) await deleteCaseViaApi(request, e2e.apiURL, id);
    for (const id of customers) await deleteCustomerViaApi(request, e2e.apiURL, id);
  }
});

test("schedule follow-up: form open, defaults, validation, state preservation, and cancel", async ({ page, request, e2e }) => {
  const customers: number[] = [];
  const cases: number[] = [];
  try {
    const customer = await createCustomerViaApi(request, e2e.apiURL, {
      name: "Liam Chen",
      email: `liam.chen.${Date.now()}@example.com`,
    });
    customers.push(customer.id);
    const work = await createCaseViaApi(request, e2e.apiURL, {
      customerId: customer.id,
      title: "Quarterly review",
    });
    cases.push(work.id);

    await page.setViewportSize({ width: 1440, height: 960 });
    await page.goto(`${e2e.baseURL}/?customerId=${customer.id}&caseId=${work.id}`);

    const scheduleBtn = page.getByRole("button", { name: "Schedule follow-up", exact: true });
    await expect(scheduleBtn).toBeEnabled();
    await scheduleBtn.click();

    // Verify form rendered
    const followupCard = page.locator(".followup-card");
    await expect(followupCard).toBeVisible();
    await expect(followupCard.getByRole("heading", { name: "Schedule follow-up" })).toBeVisible();

    // Verify customer & case context
    await expect(followupCard.getByText("Liam Chen")).toBeVisible();
    await expect(followupCard.getByText(/Quarterly review/)).toBeVisible();

    // Verify default title is "Follow up with Liam Chen"
    const titleInput = followupCard.getByLabel(/Follow-up title/i);
    await expect(titleInput).toHaveValue("Follow up with Liam Chen");

    // Verify due date is empty by default (NOT auto-selected)
    const dueDateInput = followupCard.getByLabel(/Due date/i);
    await expect(dueDateInput).toHaveValue("");

    // Verify disclosure notice
    await expect(
      followupCard.getByText("This schedules an internal task for your team. It does not send an email, SMS, or notification to the customer.")
    ).toBeVisible();

    // Test validation: attempt to submit with empty due date
    const submitBtn = followupCard.getByRole("button", { name: "Save follow-up" });
    await submitBtn.click();
    await expect(followupCard.getByText("Please choose a target due date.")).toBeVisible();
    await expect(followupCard.getByText("Due date is required for a follow-up reminder.")).toBeVisible();

    // Verify entered values are preserved after validation error
    await titleInput.fill("Call Liam regarding renewal");
    const descInput = followupCard.getByLabel(/Description/i);
    await descInput.fill("Discuss contract terms for next quarter.");
    await submitBtn.click();

    // Still fails because due date is empty, but title and description are preserved!
    await expect(titleInput).toHaveValue("Call Liam regarding renewal");
    await expect(descInput).toHaveValue("Discuss contract terms for next quarter.");
    await expect(followupCard.getByText("Please choose a target due date.")).toBeVisible();

    // Test cancellation via Escape key
    await page.keyboard.press("Escape");
    await expect(followupCard).not.toBeVisible();

    // Reopen form and test cancellation via Cancel button
    await scheduleBtn.click();
    await expect(followupCard).toBeVisible();
    await followupCard.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(followupCard).not.toBeVisible();

    // Reopen form and test close button (X)
    await scheduleBtn.click();
    await expect(followupCard).toBeVisible();
    await followupCard.getByRole("button", { name: "Close follow-up form" }).click();
    await expect(followupCard).not.toBeVisible();
  } finally {
    for (const id of cases) await deleteCaseViaApi(request, e2e.apiURL, id);
    for (const id of customers) await deleteCustomerViaApi(request, e2e.apiURL, id);
  }
});

test("schedule follow-up: successful creation, case timeline update, confirmation link, and KPI visibility", async ({ page, request, e2e }) => {
  const customers: number[] = [];
  const cases: number[] = [];
  const tasks: number[] = [];
  try {
    const today = businessTodayIso();
    const customer = await createCustomerViaApi(request, e2e.apiURL, {
      name: "Marcus Vance",
      email: `marcus.vance.${Date.now()}@example.com`,
    });
    customers.push(customer.id);
    const work = await createCaseViaApi(request, e2e.apiURL, {
      customerId: customer.id,
      title: "Onboarding delivery",
    });
    cases.push(work.id);

    await page.setViewportSize({ width: 1440, height: 960 });
    await page.goto(`${e2e.baseURL}/?customerId=${customer.id}&caseId=${work.id}`);

    // Click "Schedule follow-up"
    await page.getByRole("button", { name: "Schedule follow-up", exact: true }).click();
    const followupCard = page.locator(".followup-card");
    await expect(followupCard).toBeVisible();

    // Fill valid follow-up
    const titleInput = followupCard.getByLabel(/Follow-up title/i);
    await titleInput.fill("Check Marcus's onboarding status");
    const dueDateInput = followupCard.getByLabel(/Due date/i);
    await dueDateInput.fill(today);
    const descInput = followupCard.getByLabel(/Description/i);
    await descInput.fill("Ensure initial integration milestone is reached.");

    // Submit
    await followupCard.getByRole("button", { name: "Save follow-up" }).click();

    // Verify success confirmation banner
    await expect(followupCard.getByText("Follow-up scheduled")).toBeVisible();
    await expect(followupCard.getByText(/Check Marcus's onboarding status.*scheduled for/)).toBeVisible();
    await expect(followupCard.getByText(/Internal task only; no customer notification was sent/)).toBeVisible();

    const caseLink = followupCard.getByRole("link", { name: new RegExp(`View on case #${work.id}`) });
    await expect(caseLink).toBeVisible();

    // Verify case timeline refreshed on the dashboard and shows the new task
    const caseTimeline = page.locator(".case-timeline");
    await expect(caseTimeline.getByText("Check Marcus's onboarding status")).toBeVisible();
    await expect(caseTimeline.getByText("To do")).toBeVisible();

    // Verify Outstanding tasks list on the dashboard reflects the task
    const outstandingTasks = page.locator(".outstanding-tasks");
    await expect(outstandingTasks.getByText("Check Marcus's onboarding status")).toBeVisible();

    // Verify responsive layout
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(followupCard).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBeTruthy();

    // Navigate to case details via link
    await caseLink.click();
    await expect(page).toHaveURL(`${e2e.baseURL}/cases/${work.id}`);
    const taskRow = page.getByRole("row", { name: /Check Marcus's onboarding status/ });
    await expect(taskRow).toBeVisible();
    await expect(taskRow.getByText("To do", { exact: true })).toBeVisible();
  } finally {
    for (const id of tasks) await deleteTaskViaApi(request, e2e.apiURL, id);
    for (const id of cases) await deleteCaseViaApi(request, e2e.apiURL, id);
    for (const id of customers) await deleteCustomerViaApi(request, e2e.apiURL, id);
  }
});
