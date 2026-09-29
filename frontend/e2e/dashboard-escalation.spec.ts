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
} from "./helpers";

test("escalation check: disabled states for no case and archived case", async ({
  page,
  request,
  e2e,
}) => {
  const customers: number[] = [];
  const cases: number[] = [];
  try {
    const emptyCustomer = await createCustomerViaApi(request, e2e.apiURL, {
      name: "Empty Customer",
      email: `escalation.empty.${Date.now()}@example.com`,
    });
    customers.push(emptyCustomer.id);

    const customer = await createCustomerViaApi(request, e2e.apiURL, {
      name: "Archived Customer",
      email: `escalation.archived.${Date.now()}@example.com`,
    });
    customers.push(customer.id);

    const work = await createCaseViaApi(request, e2e.apiURL, {
      customerId: customer.id,
      title: "Archived escalation case",
    });
    cases.push(work.id);

    // 1. Visit dashboard with customer who has no cases
    await page.goto(`${e2e.baseURL}/?customerId=${emptyCustomer.id}`);
    const noCaseEscalationBtn = page.getByRole("button", { name: /Escalation check/i });
    await expect(noCaseEscalationBtn).toBeDisabled();
    await expect(noCaseEscalationBtn).toHaveAttribute(
      "title",
      "Select a case to check for escalation flags",
    );
    await expect(noCaseEscalationBtn.locator(".action-soon")).toHaveText("Select case");

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
    const archivedEscalationBtn = page.getByRole("button", { name: /Escalation check/i });
    await expect(archivedEscalationBtn).toBeDisabled();
    await expect(archivedEscalationBtn).toHaveAttribute(
      "title",
      "Archived cases cannot be evaluated for escalation",
    );
    await expect(archivedEscalationBtn.locator(".action-soon")).toHaveText("Archived");
  } finally {
    for (const id of cases) await deleteCaseViaApi(request, e2e.apiURL, id);
    for (const id of customers) await deleteCustomerViaApi(request, e2e.apiURL, id);
  }
});

test("escalation check: overdue task flag, deep link to task, and clean empty state", async ({
  page,
  request,
  e2e,
}) => {
  const customers: number[] = [];
  const cases: number[] = [];
  const tasks: number[] = [];
  try {
    const customer = await createCustomerViaApi(request, e2e.apiURL, {
      name: "Overdue Esc Customer",
      email: `escalation.overdue.${Date.now()}@example.com`,
    });
    customers.push(customer.id);

    const work = await createCaseViaApi(request, e2e.apiURL, {
      customerId: customer.id,
      title: "Active Case With Overdue Task",
    });
    cases.push(work.id);

    // Overdue unfinished task
    const overdueTask = await createTaskViaApi(request, e2e.apiURL, {
      caseId: work.id,
      title: "Urgent contract renewal",
      dueDate: "2026-01-01",
      priority: "Normal",
    });
    tasks.push(overdueTask.id);

    await page.setViewportSize({ width: 1440, height: 960 });
    await page.goto(`${e2e.baseURL}/?customerId=${customer.id}&caseId=${work.id}`);

    const escalationBtn = page.getByRole("button", { name: /Escalation check/i });
    await expect(escalationBtn).toBeEnabled();
    await escalationBtn.click();

    // Verify Escalation output container
    const escalationOutput = page.locator(".escalation-output");
    await expect(escalationOutput).toBeVisible();

    // Verify "Needs review" badges and summary
    await expect(escalationOutput.locator(".escalation-badge")).toHaveText("Needs review");
    await expect(escalationOutput.locator(".escalation-summary-text")).toContainText("1 item needs review");

    // Verify Rule 1 flag: Overdue task
    await expect(escalationOutput.locator(".escalation-rule-tag")).toHaveText("Overdue task");
    await expect(escalationOutput.locator(".escalation-flag-reason")).toContainText("is overdue");

    // Verify Task link exists and links to #task-${overdueTask.id}
    const taskLink = escalationOutput.getByRole("link", { name: /View task “Urgent contract renewal”/i });
    await expect(taskLink).toBeVisible();
    await expect(taskLink).toHaveAttribute("href", `/cases/${work.id}#task-${overdueTask.id}`);

    // Click the task link and verify navigation
    await taskLink.click();
    await expect(page).toHaveURL(new RegExp(`/cases/${work.id}#task-${overdueTask.id}`));
    await expect(page.locator(`#task-${overdueTask.id}`)).toBeVisible();

    // Now update the overdue task to Done and add a future normal task so the case has unfinished work on track
    const markDoneRes = await request.put(`${e2e.apiURL}/api/tasks/${overdueTask.id}`, {
      headers: bearerHeaders(e2e),
      data: {
        caseId: work.id,
        title: "Urgent contract renewal",
        description: null,
        dueDate: "2026-01-01",
        priority: "Normal",
        status: "Done",
      },
    });
    expect(markDoneRes.ok()).toBeTruthy();

    const futureTask = await createTaskViaApi(request, e2e.apiURL, {
      caseId: work.id,
      title: "Future milestone prep",
      dueDate: "2028-12-31",
      priority: "Normal",
    });
    tasks.push(futureTask.id);

    // Revisit dashboard and run escalation check again
    await page.goto(`${e2e.baseURL}/?customerId=${customer.id}&caseId=${work.id}`);
    await page.getByRole("button", { name: /Escalation check/i }).click();

    // Verify clean state
    const cleanOutput = page.locator(".escalation-output");
    await expect(cleanOutput).toBeVisible();
    await expect(cleanOutput.locator(".escalation-badge")).toHaveText("Deterministic rules");
    await expect(cleanOutput.getByText("No attention flags found.")).toBeVisible();
    await expect(
      cleanOutput.getByText("No overdue tasks, high-priority work, or unstaffed case conditions detected."),
    ).toBeVisible();
  } finally {
    for (const id of tasks) await deleteTaskViaApi(request, e2e.apiURL, id);
    for (const id of cases) await deleteCaseViaApi(request, e2e.apiURL, id);
    for (const id of customers) await deleteCustomerViaApi(request, e2e.apiURL, id);
  }
});

test("escalation check: high priority task and open case with no unfinished tasks", async ({
  page,
  request,
  e2e,
}) => {
  const customers: number[] = [];
  const cases: number[] = [];
  const tasks: number[] = [];
  try {
    const customer = await createCustomerViaApi(request, e2e.apiURL, {
      name: "High Priority Esc Customer",
      email: `escalation.highpri.${Date.now()}@example.com`,
    });
    customers.push(customer.id);

    // Case 1: Open case with NO tasks at all (Rule 3)
    const emptyCase = await createCaseViaApi(request, e2e.apiURL, {
      customerId: customer.id,
      title: "Unstaffed Case With Zero Tasks",
    });
    cases.push(emptyCase.id);

    // Case 2: Case with high-priority unfinished task (Rule 2)
    const highPriCase = await createCaseViaApi(request, e2e.apiURL, {
      customerId: customer.id,
      title: "Case With High Priority Work",
    });
    cases.push(highPriCase.id);

    const highPriTask = await createTaskViaApi(request, e2e.apiURL, {
      caseId: highPriCase.id,
      title: "Server migration cutover",
      dueDate: "2028-12-31",
      priority: "High",
    });
    tasks.push(highPriTask.id);

    // Test Rule 3: Zero tasks on Open case
    await page.goto(`${e2e.baseURL}/?customerId=${customer.id}&caseId=${emptyCase.id}`);
    await page.getByRole("button", { name: /Escalation check/i }).click();

    const emptyCaseOutput = page.locator(".escalation-output");
    await expect(emptyCaseOutput).toBeVisible();
    await expect(emptyCaseOutput.locator(".escalation-rule-tag")).toHaveText("No unfinished tasks");
    await expect(emptyCaseOutput.locator(".escalation-flag-reason")).toContainText(
      "Case is Open with no unfinished tasks",
    );
    const caseTasksLink = emptyCaseOutput.getByRole("link", { name: "Open case tasks" });
    await expect(caseTasksLink).toBeVisible();
    await expect(caseTasksLink).toHaveAttribute("href", `/cases/${emptyCase.id}#case-tasks-heading`);

    // Test Rule 2: High priority unfinished task
    await page.goto(`${e2e.baseURL}/?customerId=${customer.id}&caseId=${highPriCase.id}`);
    await page.getByRole("button", { name: /Escalation check/i }).click();

    const highPriOutput = page.locator(".escalation-output");
    await expect(highPriOutput).toBeVisible();
    await expect(highPriOutput.locator(".escalation-rule-tag")).toHaveText("High priority");
    await expect(highPriOutput.locator(".escalation-flag-reason")).toContainText(
      "is unfinished",
    );
    const highPriTaskLink = highPriOutput.getByRole("link", {
      name: /View task “Server migration cutover”/i,
    });
    await expect(highPriTaskLink).toBeVisible();
  } finally {
    for (const id of tasks) await deleteTaskViaApi(request, e2e.apiURL, id);
    for (const id of cases) await deleteCaseViaApi(request, e2e.apiURL, id);
    for (const id of customers) await deleteCustomerViaApi(request, e2e.apiURL, id);
  }
});

test("escalation check: combined flags, clearing results on case change, and mobile responsiveness", async ({
  page,
  request,
  e2e,
}) => {
  const customers: number[] = [];
  const cases: number[] = [];
  const tasks: number[] = [];
  try {
    const customer = await createCustomerViaApi(request, e2e.apiURL, {
      name: "Multi Esc Customer",
      email: `escalation.multi.${Date.now()}@example.com`,
    });
    customers.push(customer.id);

    // Case A: Has both an overdue task AND a high priority task
    const caseA = await createCaseViaApi(request, e2e.apiURL, {
      customerId: customer.id,
      title: "Critical Multi-Flag Case",
    });
    cases.push(caseA.id);

    const task1 = await createTaskViaApi(request, e2e.apiURL, {
      caseId: caseA.id,
      title: "Expired audit submission",
      dueDate: "2026-01-01",
      priority: "Normal",
    });
    tasks.push(task1.id);

    const task2 = await createTaskViaApi(request, e2e.apiURL, {
      caseId: caseA.id,
      title: "Executive briefing deck",
      dueDate: "2028-12-31",
      priority: "High",
    });
    tasks.push(task2.id);

    // Case B: Clean case with on-track normal task
    const caseB = await createCaseViaApi(request, e2e.apiURL, {
      customerId: customer.id,
      title: "Quiet Normal Case",
    });
    cases.push(caseB.id);

    const task3 = await createTaskViaApi(request, e2e.apiURL, {
      caseId: caseB.id,
      title: "Standard check-in call",
      dueDate: "2028-12-31",
      priority: "Normal",
    });
    tasks.push(task3.id);

    // 1. Visit Case A and run check: should have 2 flags
    await page.goto(`${e2e.baseURL}/?customerId=${customer.id}&caseId=${caseA.id}`);
    await page.getByRole("button", { name: /Escalation check/i }).click();

    const outputA = page.locator(".escalation-output");
    await expect(outputA).toBeVisible();
    await expect(outputA.locator(".escalation-summary-text")).toContainText("2 items need review");
    const flagItems = outputA.locator(".escalation-flag-item");
    await expect(flagItems).toHaveCount(2);

    // 2. Switch case to Case B: results from Case A should be cleared!
    await page.getByLabel("Choose a case").selectOption(String(caseB.id));
    await expect(page.locator(".escalation-output")).toHaveCount(0);

    // 3. Test mobile viewport
    await page.setViewportSize({ width: 390, height: 844 });
    const mobileEscalationBtn = page.getByRole("button", { name: /Escalation check/i });
    await expect(mobileEscalationBtn).toBeVisible();
    await mobileEscalationBtn.click();

    // Verify clean state rendered on mobile without overflow
    const mobileOutput = page.locator(".escalation-output");
    await expect(mobileOutput).toBeVisible();
    await expect(mobileOutput.getByText("No attention flags found.")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
  } finally {
    for (const id of tasks) await deleteTaskViaApi(request, e2e.apiURL, id);
    for (const id of cases) await deleteCaseViaApi(request, e2e.apiURL, id);
    for (const id of customers) await deleteCustomerViaApi(request, e2e.apiURL, id);
  }
});
