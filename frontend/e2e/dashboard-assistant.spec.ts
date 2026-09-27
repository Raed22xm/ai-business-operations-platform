import { test, expect, createCustomerViaApi, createCaseViaApi, createTaskViaApi, deleteCaseViaApi, deleteCustomerViaApi } from "./helpers";

test("assistant generate summary and draft response with mock provider", async ({ page, request, e2e }) => {
  const customers: number[] = [];
  const cases: number[] = [];
  const tasks: number[] = [];
  try {
    const customer = await createCustomerViaApi(request, e2e.apiURL, {
      name: "Ada Assistant",
      email: `ada.assistant.${Date.now()}@example.com`,
      company: "Ops Lab",
    });
    customers.push(customer.id);
    const work = await createCaseViaApi(request, e2e.apiURL, {
      customerId: customer.id,
      title: "Assistant wiring check",
      description: "Confirm AI summary and draft use saved case data.",
    });
    cases.push(work.id);
    const task = await createTaskViaApi(request, e2e.apiURL, {
      caseId: work.id,
      title: "Review draft",
    });
    tasks.push(task.id);

    await page.setViewportSize({ width: 1440, height: 960 });
    await page.goto(`${e2e.baseURL}/?customerId=${customer.id}&caseId=${work.id}`);

    const summaryButton = page.getByRole("button", { name: "Generate summary", exact: true });
    await expect(summaryButton).toBeEnabled();
    await summaryButton.click();
    await expect(page.getByLabel("Generated summary text")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Demo response — AI not connected").first()).toBeVisible();
    await expect(page.getByLabel("Generated summary text")).toContainText("Request:");
    await expect(page.getByLabel("Generated summary text")).toContainText("Assistant wiring check");
    await expect(page.getByRole("button", { name: "Copy", exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Draft response", exact: true }).click();
    await expect(page.getByLabel("Draft response text")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Demo response — AI not connected").first()).toBeVisible();
    await expect(page.getByLabel("Draft response text")).toContainText("Hello");

    await page.getByRole("button", { name: "Copy", exact: true }).focus();
    await expect(page.getByRole("button", { name: "Copy", exact: true })).toBeFocused();

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByLabel("Draft response text")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBeTruthy();
  } finally {
    for (const id of tasks) await request.delete(`${e2e.apiURL}/api/tasks/${id}`);
    for (const id of cases) await deleteCaseViaApi(request, e2e.apiURL, id);
    for (const id of customers) await deleteCustomerViaApi(request, e2e.apiURL, id);
  }
});

test("assistant clears output when selected case changes", async ({ page, request, e2e }) => {
  const customers: number[] = [];
  const cases: number[] = [];
  try {
    const customer = await createCustomerViaApi(request, e2e.apiURL, {
      name: "Clear Output",
      email: `clear.output.${Date.now()}@example.com`,
    });
    customers.push(customer.id);
    const first = await createCaseViaApi(request, e2e.apiURL, {
      customerId: customer.id,
      title: "First assistant case",
    });
    const second = await createCaseViaApi(request, e2e.apiURL, {
      customerId: customer.id,
      title: "Second assistant case",
    });
    cases.push(first.id, second.id);

    await page.goto(`${e2e.baseURL}/?customerId=${customer.id}&caseId=${first.id}`);
    await page.getByRole("button", { name: "Generate summary", exact: true }).click();
    await expect(page.getByLabel("Generated summary text")).toBeVisible({ timeout: 15_000 });
    await page.getByLabel("Choose a case").selectOption(String(second.id));
    await expect(page.getByRole("heading", { name: "Second assistant case", exact: true })).toBeVisible();
    await expect(page.getByLabel("Generated summary text")).toHaveCount(0);
  } finally {
    for (const id of cases) await deleteCaseViaApi(request, e2e.apiURL, id);
    for (const id of customers) await deleteCustomerViaApi(request, e2e.apiURL, id);
  }
});
