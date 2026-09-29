import {
  test,
  expect,
  bearerHeaders,
  createCustomerViaApi,
  createCaseViaApi,
  createTaskViaApi,
  deleteCaseViaApi,
  deleteCustomerViaApi,
  deleteTaskViaApi,
  uniqueMarker,
} from "./helpers";

test("customer details: unified activity timeline aggregates events across cases", async ({
  page,
  request,
  e2e,
}) => {
  const marker = uniqueMarker("cust-act");
  let customerId = 0;
  const createdCases: number[] = [];
  const createdTasks: number[] = [];

  try {
    // 1. Create a customer
    const customer = await createCustomerViaApi(request, e2e.apiURL, {
      name: `${marker} Activity Client`,
      email: `${marker}@example.com`,
    });
    customerId = customer.id;

    // 2. Create Case Alpha
    const case1 = await createCaseViaApi(request, e2e.apiURL, {
      customerId: customer.id,
      title: `${marker} Alpha Operations`,
      description: "First case for activity audit",
    });
    createdCases.push(case1.id);

    // 3. Create Case Beta
    const case2 = await createCaseViaApi(request, e2e.apiURL, {
      customerId: customer.id,
      title: `${marker} Beta Deployment`,
      description: "Second case for activity audit",
    });
    createdCases.push(case2.id);

    // 4. Create and complete a task in Case Alpha
    const task = await createTaskViaApi(request, e2e.apiURL, {
      caseId: case1.id,
      title: `${marker} Review SLA`,
      priority: "High",
    });
    createdTasks.push(task.id);

    // Update task to Done via status endpoint
    const statusUpdateRes = await request.patch(`${e2e.apiURL}/api/tasks/${task.id}/status`, {
      headers: {
        ...bearerHeaders(e2e),
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      data: { status: "Done" },
    });
    expect(statusUpdateRes.ok()).toBeTruthy();

    // 5. Navigate to customer details page
    await page.goto(`${e2e.baseURL}/customers/${customer.id}`);

    // 6. Verify Customer Activity Timeline section
    const heading = page.getByRole("heading", { name: "Activity Timeline" });
    await expect(heading).toBeVisible();

    // Verify events appear in the unified chronological feed
    await expect(page.getByText("Task marked Done")).toBeVisible();
    await expect(page.getByText("Task created")).toBeVisible();
    await expect(page.getByText("Case created").first()).toBeVisible();

    // Verify case titles are linked in the activity stream
    const alphaLink = page.getByRole("link", { name: `Case: ${marker} Alpha Operations` }).first();
    await expect(alphaLink).toBeVisible();

    const betaLink = page.getByRole("link", { name: `Case: ${marker} Beta Deployment` });
    await expect(betaLink).toBeVisible();

    // 7. Verify navigation when clicking a case link
    await alphaLink.click();
    await expect(page).toHaveURL(new RegExp(`/cases/${case1.id}`));
  } finally {
    for (const taskId of createdTasks) {
      await deleteTaskViaApi(request, e2e.apiURL, taskId);
    }
    for (const caseId of createdCases) {
      await deleteCaseViaApi(request, e2e.apiURL, caseId);
    }
    if (customerId > 0) {
      await deleteCustomerViaApi(request, e2e.apiURL, customerId);
    }
  }
});
