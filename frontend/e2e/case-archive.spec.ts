import {
  test,
  expect,
  createCustomerViaApi,
  createCaseViaApi,
  createTaskViaApi,
  deleteCaseViaApi,
  deleteCustomerViaApi,
  deleteTaskViaApi,
  bearerHeaders,
  uniqueMarker,
} from "./helpers";

test("archive filters, restore, blocked edits, export, and access control", async ({
  page,
  request,
  e2e,
}) => {
  const customers: number[] = [];
  const cases: number[] = [];
  const tasks: number[] = [];
  try {
    const marker = uniqueMarker("archive-e2e");
    const customer = await createCustomerViaApi(request, e2e.apiURL, {
      name: `${marker} Customer`,
      email: `${marker}@example.com`,
    });
    customers.push(customer.id);

    const openCase = await createCaseViaApi(request, e2e.apiURL, {
      customerId: customer.id,
      title: `${marker} open`,
    });
    cases.push(openCase.id);

    const closedCase = await createCaseViaApi(request, e2e.apiURL, {
      customerId: customer.id,
      title: `${marker} closed ready`,
      description: "Ready to archive",
    });
    cases.push(closedCase.id);
    await request.put(`${e2e.apiURL}/api/cases/${closedCase.id}`, {
      headers: bearerHeaders(e2e),
      data: {
        title: closedCase.title,
        description: "Ready to archive",
        status: "Closed",
      },
    });
    const doneTask = await createTaskViaApi(request, e2e.apiURL, {
      caseId: closedCase.id,
      title: `${marker} done task`,
    });
    tasks.push(doneTask.id);
    await request.put(`${e2e.apiURL}/api/tasks/${doneTask.id}`, {
      headers: bearerHeaders(e2e),
      data: {
        title: doneTask.title,
        description: null,
        dueDate: null,
        status: "Done",
      },
    });

    const incompleteCase = await createCaseViaApi(request, e2e.apiURL, {
      customerId: customer.id,
      title: `${marker} closed incomplete`,
    });
    cases.push(incompleteCase.id);
    await request.put(`${e2e.apiURL}/api/cases/${incompleteCase.id}`, {
      headers: bearerHeaders(e2e),
      data: {
        title: incompleteCase.title,
        description: null,
        status: "Closed",
      },
    });
    const openTask = await createTaskViaApi(request, e2e.apiURL, {
      caseId: incompleteCase.id,
      title: `${marker} open task`,
    });
    tasks.push(openTask.id);

    await page.setViewportSize({ width: 1440, height: 960 });

    // Open case explains why archive is unavailable.
    await page.goto(`${e2e.baseURL}/cases/${openCase.id}`);
    await expect(page.getByRole("button", { name: "Archive", exact: true })).toBeDisabled();
    await expect(page.getByText("Only closed cases can be archived.")).toBeVisible();

    // Incomplete closed case explains task requirement.
    await page.goto(`${e2e.baseURL}/cases/${incompleteCase.id}`);
    await expect(page.getByRole("button", { name: "Archive", exact: true })).toBeDisabled();
    await expect(
      page.getByText("Archive requires every task on the case to be Done."),
    ).toBeVisible();

    // Archive eligible closed case from details with named confirmation.
    await page.goto(`${e2e.baseURL}/cases/${closedCase.id}`);
    await page.getByRole("button", { name: "Archive", exact: true }).click();
    const archiveDialog = page.getByRole("dialog");
    await expect(archiveDialog.getByRole("heading", { name: `Archive ${closedCase.title}?` })).toBeVisible();
    await archiveDialog.getByRole("button", { name: "Archive", exact: true }).click();
    await expect(page.getByText(`${closedCase.title} was archived.`)).toBeVisible();
    await expect(page.getByText("Archived", { exact: true }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Restore", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Edit case", exact: true })).toHaveCount(0);
    await expect(page.getByText("Tasks are read-only while this case is archived.")).toBeVisible();
    await expect(page.getByText("Case archived", { exact: true })).toBeVisible();

    // Active filter hides archived; Archived filter shows it.
    await page.goto(`${e2e.baseURL}/cases?customerId=${customer.id}`);
    const archiveFilter = page.getByLabel("Archive", { exact: true });
    await expect(archiveFilter).toHaveValue("active");
    await expect(page.getByRole("link", { name: closedCase.title, exact: true })).toHaveCount(0);
    await expect(page.getByRole("link", { name: openCase.title, exact: true })).toBeVisible();

    await archiveFilter.selectOption("archived");
    await expect(page).toHaveURL(/archive=archived/);
    await expect(page.getByRole("link", { name: closedCase.title, exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: openCase.title, exact: true })).toHaveCount(0);

    await archiveFilter.selectOption("all");
    await expect(page).toHaveURL(/archive=all/);
    await expect(page.getByRole("link", { name: closedCase.title, exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: openCase.title, exact: true })).toBeVisible();

    // CSV export respects archive filter and includes Archived At.
    const archivedExport = await page.request.get(
      `${e2e.baseURL}/cases/export?customerId=${customer.id}&archive=archived`,
    );
    expect(archivedExport.ok()).toBeTruthy();
    const archivedCsv = await archivedExport.text();
    expect(archivedCsv).toContain(
      "Id,Customer Id,Customer Name,Title,Description,Status,Created At (UTC),Archived At (UTC)",
    );
    expect(archivedCsv).toContain(closedCase.title);
    expect(archivedCsv).not.toContain(openCase.title);

    const activeExport = await page.request.get(
      `${e2e.baseURL}/cases/export?customerId=${customer.id}`,
    );
    expect(activeExport.ok()).toBeTruthy();
    const activeCsv = await activeExport.text();
    expect(activeCsv).toContain(openCase.title);
    expect(activeCsv).not.toContain(closedCase.title);

    // Backend blocks edits and repeat archive; restore works.
    const blockedUpdate = await request.put(`${e2e.apiURL}/api/cases/${closedCase.id}`, {
      headers: bearerHeaders(e2e),
      data: {
        title: `${closedCase.title} mutated`,
        description: null,
        status: "Closed",
      },
    });
    expect(blockedUpdate.status()).toBe(409);

    const blockedTask = await request.post(`${e2e.apiURL}/api/tasks`, {
      headers: bearerHeaders(e2e),
      data: {
        caseId: closedCase.id,
        title: `${marker} blocked`,
        description: null,
        dueDate: null,
      },
    });
    expect(blockedTask.status()).toBe(409);

    const repeatArchive = await request.post(
      `${e2e.apiURL}/api/cases/${closedCase.id}/archive`,
      { headers: bearerHeaders(e2e) },
    );
    expect(repeatArchive.status()).toBe(409);

    const anonArchive = await request.post(`${e2e.apiURL}/api/cases/${closedCase.id}/archive`);
    expect(anonArchive.status()).toBe(401);
    const anonRestore = await request.post(`${e2e.apiURL}/api/cases/${closedCase.id}/restore`);
    expect(anonRestore.status()).toBe(401);

    // Customer delete still blocked while archived case exists.
    const deleteCustomer = await request.delete(`${e2e.apiURL}/api/customers/${customer.id}`, {
      headers: bearerHeaders(e2e),
    });
    expect(deleteCustomer.status()).toBe(409);

    await page.goto(`${e2e.baseURL}/cases/${closedCase.id}`);
    await page.getByRole("button", { name: "Restore", exact: true }).click();
    const restoreDialog = page.getByRole("dialog");
    await expect(restoreDialog.getByRole("heading", { name: `Restore ${closedCase.title}?` })).toBeVisible();
    await restoreDialog.getByRole("button", { name: "Restore", exact: true }).click();
    await expect(page.getByText(`${closedCase.title} was restored.`)).toBeVisible();
    await expect(page.getByRole("button", { name: "Edit case", exact: true })).toBeVisible();
    await expect(page.getByText("Case restored", { exact: true })).toBeVisible();

    const after = await request.get(`${e2e.apiURL}/api/cases/${closedCase.id}`, {
      headers: bearerHeaders(e2e),
    });
    expect(after.ok()).toBeTruthy();
    const body = (await after.json()) as { archivedAt: string | null; status: string };
    expect(body.archivedAt).toBeNull();
    expect(body.status).toBe("Closed");
  } finally {
    for (const id of tasks) await deleteTaskViaApi(request, e2e.apiURL, id);
    for (const id of cases) {
      await request.post(`${e2e.apiURL}/api/cases/${id}/restore`, {
        headers: bearerHeaders(e2e),
      });
      await deleteCaseViaApi(request, e2e.apiURL, id);
    }
    for (const id of customers) await deleteCustomerViaApi(request, e2e.apiURL, id);
  }
});
