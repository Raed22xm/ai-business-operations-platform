import {
  bearerHeaders,
  deleteCaseViaApi,
  deleteCustomerViaApi,
  deleteTaskViaApi,
  expect,
  test,
  uniqueMarker,
} from "./helpers";
import { E2E_AUTH_PASSWORD, E2E_AUTH_USERNAME } from "./env";

test("complete business workflow: sign in → inquiry → customer & case → tasks → AI draft → edit & approve → follow-up → escalation → complete & close → sign out", async ({
  browser,
  request,
  e2e,
}) => {
  // Start with fresh unauthenticated context
  const context = await browser.newContext({
    baseURL: e2e.baseURL,
    storageState: { cookies: [], origins: [] },
  });
  const page = await context.newPage();

  const marker = uniqueMarker("wf");
  const email = `${marker}@example.com`;
  const customerName = `${marker} Workflow Client`;
  const company = `${marker} Enterprises`;
  const phone = "555-0199";
  const caseTitle = `${marker} Workflow Automation Proposal`;
  const caseDescription = "Customer requires end-to-end operational automation setup.";

  const cleanup = {
    customerId: 0,
    caseId: 0,
    taskIds: [] as number[],
  };

  try {
    // ==========================================
    // Stage 1: Sign in
    // ==========================================
    await page.goto(`${e2e.baseURL}/`);
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();

    await page.getByLabel("Username").fill(E2E_AUTH_USERNAME);
    await page.getByLabel("Password").fill(E2E_AUTH_PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page).toHaveURL(`${e2e.baseURL}/`);
    await expect(page.getByRole("main", { name: "Operations dashboard" })).toBeVisible();

    // ==========================================
    // Stage 2: New inquiry (/inquiry)
    // ==========================================
    await page.goto(`${e2e.baseURL}/inquiry`);
    await expect(page.getByRole("heading", { name: "New Customer Inquiry" })).toBeVisible();

    // Fill customer email & trigger resolver
    const emailInput = page.getByLabel(/Customer email/i);
    await emailInput.fill(email);
    await emailInput.blur();
    await expect(page.getByText(/No existing customer matches this email/i)).toBeVisible({
      timeout: 5000,
    });

    // Fill customer & case details
    await page.getByLabel(/^Customer name/i).fill(customerName);
    await page.getByLabel(/^Company/i).fill(company);
    await page.getByLabel(/^Phone/i).fill(phone);
    await page.getByLabel(/^Request title/i).fill(caseTitle);
    await page.getByLabel(/^Inquiry description/i).fill(caseDescription);

    // Save inquiry & open case
    await page.getByRole("button", { name: /Save inquiry & open case/i }).click();

    // ==========================================
    // Stage 3: Customer and case created
    // ==========================================
    await page.waitForURL(/\/cases\/\d+/);
    const caseUrl = page.url();
    const caseIdMatch = caseUrl.match(/\/cases\/(\d+)/);
    expect(caseIdMatch).toBeTruthy();
    cleanup.caseId = Number(caseIdMatch![1]);

    await expect(page.getByRole("heading", { name: caseTitle })).toBeVisible();
    await expect(page.locator('.record-status[data-status="Open"]')).toBeVisible();
    await expect(page.getByRole("link", { name: customerName })).toBeVisible();

    // Fetch customer ID from API for dashboard navigation and cleanup
    const caseApiRes = await request.get(`${e2e.apiURL}/api/cases/${cleanup.caseId}`, {
      headers: bearerHeaders(e2e),
    });
    expect(caseApiRes.ok()).toBeTruthy();
    const caseApiData = await caseApiRes.json();
    cleanup.customerId = caseApiData.customerId;

    // ==========================================
    // Stage 4: Tasks on case
    // ==========================================
    const tasksHeading = page.getByRole("heading", { name: "Tasks", level: 2 });
    await expect(tasksHeading).toBeVisible();

    // Add first task via UI
    const taskTitle = `${marker} Initial technical scoping`;
    await page.locator("#task-title").fill(taskTitle);
    await page.locator("#task-due-date").fill("2028-11-01");
    await page.locator("#task-priority").selectOption("Normal");
    await page.getByRole("button", { name: "Add task" }).click();

    // Verify task row appears in the table
    const taskRow = page.locator("tr", { hasText: taskTitle });
    await expect(taskRow).toBeVisible();
    await expect(taskRow.locator('.record-status[data-status="Todo"]')).toBeVisible();

    // ==========================================
    // Stage 5: AI response draft (mocked provider)
    // ==========================================
    const draftsSection = page.getByRole("region", { name: "Response drafts" });
    await expect(draftsSection).toBeVisible();

    // Generate mock AI draft
    const generateAiBtn = draftsSection.getByRole("button", { name: /Generate with AI/i });
    await expect(generateAiBtn).toBeVisible();
    await generateAiBtn.click();

    // Verify draft appears with status Draft and Mock source
    const draftCard = draftsSection.locator(".draft-card").first();
    await expect(draftCard).toBeVisible();
    await expect(draftCard.locator('.record-status[data-status="Draft"]')).toBeVisible();
    await expect(draftCard.locator('.draft-source-badge[data-source="Mock"]')).toBeVisible();
    await expect(draftCard).toContainText("Demo response (AI not connected)");

    // ==========================================
    // Stage 6: Edit and approve draft
    // ==========================================
    const editedDraftContent = `${marker} Carefully reviewed and tailored proposal text for ${customerName}.`;

    // Click Edit on draft
    await draftCard.getByRole("button", { name: "Edit" }).click();
    const draftTextarea = draftCard.locator("textarea");
    await expect(draftTextarea).toBeVisible();
    await draftTextarea.fill(editedDraftContent);

    // Save changes
    await draftCard.getByRole("button", { name: "Save edits" }).click();
    await expect(page.getByText(/Draft updated/i)).toBeVisible();
    await expect(draftCard.locator(".draft-content-text")).toHaveText(editedDraftContent);

    // Check that saved changes survive page refresh
    await page.reload();
    const reloadedDraftCard = page.locator(".draft-card").first();
    await expect(reloadedDraftCard.locator(".draft-content-text")).toHaveText(editedDraftContent);

    // Approve the saved draft
    const approveBtn = reloadedDraftCard.getByRole("button", { name: "Approve draft" });
    await expect(approveBtn).toBeVisible();
    await approveBtn.click();

    await expect(page.getByText("Draft approved.")).toBeVisible();
    await expect(reloadedDraftCard.locator('.record-status[data-status="Approved"]')).toBeVisible();

    // ==========================================
    // Stage 7: Schedule follow-up via Dashboard
    // ==========================================
    await page.goto(`${e2e.baseURL}/?customerId=${cleanup.customerId}&caseId=${cleanup.caseId}`);
    const assistantHeading = page.getByRole("heading", { name: "AI operations assistant" });
    await expect(assistantHeading).toBeVisible();

    // Open Schedule follow-up form
    const scheduleFollowUpBtn = page.getByRole("button", { name: "Schedule follow-up" });
    await expect(scheduleFollowUpBtn).toBeEnabled();
    await scheduleFollowUpBtn.click();

    const followupCard = page.locator(".followup-card");
    await expect(followupCard).toBeVisible();
    await expect(followupCard.getByText(customerName)).toBeVisible();

    // Set target due date and submit
    await followupCard.locator("#followup-due-date").fill("2028-11-15");
    await followupCard.getByRole("button", { name: "Save follow-up" }).click();

    // Verify scheduled confirmation
    await expect(page.getByText(/Follow-up task .* scheduled for 2028-11-15/i)).toBeVisible();

    // ==========================================
    // Stage 8: Escalation check
    // ==========================================
    const escalationBtn = page.getByRole("button", { name: "Escalation check" });
    await expect(escalationBtn).toBeEnabled();
    await escalationBtn.click();

    // Deterministic rule-based evaluation (tasks are on track, case has unfinished tasks)
    const escalationOutput = page.locator(".escalation-output");
    await expect(escalationOutput).toBeVisible();
    await expect(escalationOutput.locator(".escalation-badge")).toHaveText("Deterministic rules");
    await expect(escalationOutput.getByText("No attention flags found.")).toBeVisible();

    // ==========================================
    // Stage 9: Complete tasks and close case
    // ==========================================
    await page.goto(`${e2e.baseURL}/cases/${cleanup.caseId}`);
    await expect(page.getByRole("heading", { name: caseTitle })).toBeVisible();

    // Fetch all tasks for the case via API to mark them Done through UI or API
    const tasksRes = await request.get(`${e2e.apiURL}/api/tasks?caseId=${cleanup.caseId}`, {
      headers: bearerHeaders(e2e),
    });
    expect(tasksRes.ok()).toBeTruthy();
    const tasksData = (await tasksRes.json()) as Array<{ id: number; title: string }>;

    for (const t of tasksData) {
      cleanup.taskIds.push(t.id);
      const markDoneRes = await request.put(`${e2e.apiURL}/api/tasks/${t.id}`, {
        headers: bearerHeaders(e2e),
        data: {
          caseId: cleanup.caseId,
          title: t.title,
          description: null,
          dueDate: "2028-11-01",
          priority: "Normal",
          status: "Done",
        },
      });
      expect(markDoneRes.ok()).toBeTruthy();
    }

    // Refresh case details to verify tasks are Done
    await page.reload();
    await expect(page.locator('.record-status[data-status="Done"]').first()).toBeVisible();

    // Edit case to Closed status
    const editCaseBtn = page.getByRole("button", { name: "Edit case" });
    await expect(editCaseBtn).toBeVisible();
    await editCaseBtn.click();

    const editCaseForm = page.getByRole("form", { name: `Edit ${caseTitle}` });
    await expect(editCaseForm).toBeVisible();
    await editCaseForm.locator("#edit-case-status").selectOption("Closed");
    await editCaseForm.getByRole("button", { name: "Save changes" }).click();

    await expect(page.getByText(`${caseTitle} was updated.`)).toBeVisible();
    await expect(page.locator('.record-status[data-status="Closed"]')).toBeVisible();

    // ==========================================
    // Stage 10: Sign out
    // ==========================================
    await page.getByText("My workspace").click();
    await page.getByRole("button", { name: "Sign out" }).click();

    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();

    // Confirm unauthenticated request is blocked
    await page.goto(`${e2e.baseURL}/cases`);
    await expect(page).toHaveURL(/\/login\?next=%2Fcases/);
  } finally {
    // Clean up disposable test records
    for (const id of cleanup.taskIds) {
      await deleteTaskViaApi(request, e2e.apiURL, id);
    }
    if (cleanup.caseId > 0) {
      await deleteCaseViaApi(request, e2e.apiURL, cleanup.caseId);
    }
    if (cleanup.customerId > 0) {
      await deleteCustomerViaApi(request, e2e.apiURL, cleanup.customerId);
    }
    await context.close();
  }
});
