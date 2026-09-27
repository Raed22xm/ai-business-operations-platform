import { test, expect, createCustomerViaApi, createCaseViaApi, createTaskViaApi, deleteCaseViaApi, deleteCustomerViaApi, deleteTaskViaApi, bearerHeaders } from "./helpers";

test("case activity timeline records changes and supports load more", async ({ page, request, e2e }) => {
  const customers: number[] = [];
  const cases: number[] = [];
  const tasks: number[] = [];
  try {
    const customer = await createCustomerViaApi(request, e2e.apiURL, {
      name: "Activity Timeline",
      email: `activity.timeline.${Date.now()}@example.com`,
    });
    customers.push(customer.id);
    const work = await createCaseViaApi(request, e2e.apiURL, {
      customerId: customer.id,
      title: "Activity history case",
      description: "Track product events",
    });
    cases.push(work.id);

    await request.put(`${e2e.apiURL}/api/cases/${work.id}`, {
      headers: bearerHeaders(e2e),
      data: {
        title: "Activity history case",
        description: "Track product events",
        status: "Closed",
      },
    });

    for (let i = 0; i < 9; i += 1) {
      const task = await createTaskViaApi(request, e2e.apiURL, {
        caseId: work.id,
        title: `Activity task ${i + 1}`,
      });
      tasks.push(task.id);
    }

    const done = await createTaskViaApi(request, e2e.apiURL, {
      caseId: work.id,
      title: "Finish checklist",
    });
    tasks.push(done.id);
    await request.put(`${e2e.apiURL}/api/tasks/${done.id}`, {
      headers: bearerHeaders(e2e),
      data: {
        title: "Finish checklist",
        description: null,
        dueDate: null,
        status: "Done",
      },
    });

    await page.setViewportSize({ width: 1440, height: 960 });
    await page.goto(`${e2e.baseURL}/cases/${work.id}`);

    await expect(page.getByRole("heading", { name: "Activity", exact: true })).toBeVisible();
    await expect(
      page.getByText(/from when activity tracking was enabled/i),
    ).toBeVisible();
    await expect(page.getByText("Task marked Done", { exact: true })).toBeVisible();
    await expect(page.getByText("Task created", { exact: true }).first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "Tasks", exact: true })).toBeVisible();

    const loadMore = page.getByRole("button", { name: "Load more" });
    await expect(loadMore).toBeVisible();
    await loadMore.click();
    await expect(page.getByText("Case status changed to Closed", { exact: true })).toBeVisible();
    await expect(page.getByText("Case created", { exact: true })).toBeVisible();
    await expect(page.getByText(/Showing \d+ of \d+ events/)).toBeVisible();

    // Failed update must not invent activity (validation error keeps history stable).
    const before = await request.get(`${e2e.apiURL}/api/cases/${work.id}/activity?page=1&pageSize=100`, {
      headers: bearerHeaders(e2e),
    });
    expect(before.ok()).toBeTruthy();
    const beforeBody = (await before.json()) as { totalCount: number };
    const failed = await request.put(`${e2e.apiURL}/api/cases/${work.id}`, {
      headers: bearerHeaders(e2e),
      data: { title: "", description: null, status: "Closed" },
    });
    expect(failed.status()).toBe(400);
    const after = await request.get(`${e2e.apiURL}/api/cases/${work.id}/activity?page=1&pageSize=100`, {
      headers: bearerHeaders(e2e),
    });
    const afterBody = (await after.json()) as { totalCount: number };
    expect(afterBody.totalCount).toBe(beforeBody.totalCount);

    // Unauthenticated access rejected.
    const anon = await request.get(`${e2e.apiURL}/api/cases/${work.id}/activity?page=1&pageSize=10`);
    expect(anon.status()).toBe(401);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${e2e.baseURL}/cases/${work.id}`);
    await expect(page.getByRole("heading", { name: "Activity", exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBeTruthy();
  } finally {
    for (const id of tasks) await deleteTaskViaApi(request, e2e.apiURL, id);
    for (const id of cases) await deleteCaseViaApi(request, e2e.apiURL, id);
    for (const id of customers) await deleteCustomerViaApi(request, e2e.apiURL, id);
  }
});
