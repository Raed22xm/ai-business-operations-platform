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

test("tasks workspace: inline status change updates task and persists across reload", async ({
  page,
  request,
  e2e,
}) => {
  const marker = uniqueMarker("twa");
  let customerId = 0;
  let caseId = 0;
  let taskId = 0;

  try {
    const customer = await createCustomerViaApi(request, e2e.apiURL, {
      name: `${marker} Client`,
      email: `${marker}@example.com`,
    });
    customerId = customer.id;

    const work = await createCaseViaApi(request, e2e.apiURL, {
      customerId: customer.id,
      title: `${marker} Operations Case`,
    });
    caseId = work.id;

    const task = await createTaskViaApi(request, e2e.apiURL, {
      caseId: work.id,
      title: `${marker} Inline Status Task`,
      priority: "High",
      dueDate: "2027-06-15",
    });
    taskId = task.id;

    // Navigate to tasks workspace filtered by caseId
    await page.goto(`${e2e.baseURL}/tasks?caseId=${caseId}`);

    // Verify task title is visible
    const taskLink = page.getByRole("link", { name: `${marker} Inline Status Task` });
    await expect(taskLink).toBeVisible();

    // Locate the status selector dropdown for this task
    const statusSelect = page.getByLabel(`Status for task ${marker} Inline Status Task`);
    await expect(statusSelect).toBeVisible();
    await expect(statusSelect).toHaveValue("Todo");
    await expect(statusSelect).toHaveAttribute("data-status", "Todo");

    // Change status from Todo to Done
    await statusSelect.selectOption("Done");

    // Verify optimistic / updated status reflects Done
    await expect(statusSelect).toHaveValue("Done");
    await expect(statusSelect).toHaveAttribute("data-status", "Done");

    // Wait for the server action to persist and display the Saved indicator
    await expect(page.getByText("Saved")).toBeVisible();

    // Reload the page to confirm persistent storage
    await page.reload();
    const reloadedStatusSelect = page.getByLabel(`Status for task ${marker} Inline Status Task`);
    await expect(reloadedStatusSelect).toBeVisible();
    await expect(reloadedStatusSelect).toHaveValue("Done");
    await expect(reloadedStatusSelect).toHaveAttribute("data-status", "Done");

    // Change status back to InProgress
    await reloadedStatusSelect.selectOption("InProgress");
    await expect(reloadedStatusSelect).toHaveValue("InProgress");
    await expect(reloadedStatusSelect).toHaveAttribute("data-status", "InProgress");
    await expect(page.getByText("Saved")).toBeVisible();
  } finally {
    if (taskId > 0) await deleteTaskViaApi(request, e2e.apiURL, taskId);
    if (caseId > 0) await deleteCaseViaApi(request, e2e.apiURL, caseId);
    if (customerId > 0) await deleteCustomerViaApi(request, e2e.apiURL, customerId);
  }
});
