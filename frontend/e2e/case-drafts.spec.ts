import {
  bearerHeaders,
  createCaseViaApi,
  createCustomerViaApi,
  createDraftViaApi,
  deleteCaseViaApi,
  deleteCustomerViaApi,
  expect,
  test,
  uniqueMarker,
} from "./helpers";

test.describe("case response drafts lifecycle and approvals", () => {
  test("create, generate, approve, edit approved, conflict detection, copy, and activity logging", async ({
    page,
    request,
    e2e,
  }) => {
    const marker = uniqueMarker("casedraft");
    const customer = await createCustomerViaApi(request, e2e.apiURL, {
      name: `${marker} Customer`,
      email: `${marker}@example.com`,
    });
    const work = await createCaseViaApi(request, e2e.apiURL, {
      customerId: customer.id,
      title: `${marker} Case For Drafts`,
      description: "Customer inquired about service launch date.",
    });

    try {
      await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
      await page.goto(`/cases/${work.id}`);

      // 1. Check response drafts section exists
      const draftsSection = page.getByRole("region", { name: "Response drafts" });
      await expect(draftsSection).toBeVisible();
      await expect(draftsSection.getByRole("heading", { name: "Response drafts", level: 2 })).toBeVisible();
      await expect(draftsSection).toContainText("No response drafts saved for this case yet.");

      // 2. Generate AI / Mock draft
      const generateAiBtn = draftsSection.getByRole("button", { name: /Generate with AI/i });
      await expect(generateAiBtn).toBeVisible();
      await generateAiBtn.click();

      // Verify draft appears with mock badge clearly labeled
      await expect(draftsSection.locator(".draft-card").first()).toBeVisible();
      await expect(draftsSection.locator(".record-status[data-status='Draft']")).toBeVisible();
      await expect(draftsSection.locator(".draft-source-badge[data-source='Mock']")).toBeVisible();
      await expect(draftsSection).toContainText("Demo response (AI not connected)");

      // 3. Create a manual draft
      await draftsSection.getByRole("button", { name: /New manual draft/i }).click();
      const manualTextarea = draftsSection.locator("#new-manual-draft-text");
      await expect(manualTextarea).toBeVisible();
      await manualTextarea.fill("Hello! Thank you for contacting support. We are reviewing your launch date.");
      await draftsSection.getByRole("button", { name: "Save draft" }).click();

      // Verify manual draft appears
      await expect(draftsSection.locator(".draft-source-badge[data-source='Manual']")).toBeVisible();
      await expect(draftsSection.getByText("Hello! Thank you for contacting support.")).toBeVisible();

      // 4. Human Approval of the manual draft
      const manualDraftArticle = draftsSection.locator("article", {
        hasText: "Hello! Thank you for contacting support.",
      });
      const approveBtn = manualDraftArticle.getByRole("button", { name: /Approve draft/i });
      await expect(approveBtn).toBeVisible();
      await approveBtn.click();

      // Verify status changed to Approved and shows locked indicator
      await expect(manualDraftArticle.locator(".record-status[data-status='Approved']")).toBeVisible();
      await expect(manualDraftArticle).toContainText("Approved by");
      await expect(manualDraftArticle).toContainText("Exact saved text locked");

      // 5. Copy draft text to clipboard
      const copyBtn = manualDraftArticle.getByRole("button", { name: /Copy text/i });
      await copyBtn.click();
      await expect(manualDraftArticle.getByText("Copied!")).toBeVisible();

      // 6. Editing approved text returns it to Draft and clears approval
      const editBtn = manualDraftArticle.getByRole("button", { name: /Edit/i });
      await editBtn.click();
      await expect(manualDraftArticle).toContainText("Saving edits to this approved draft will reset its status to Draft");

      const editTextarea = manualDraftArticle.locator("textarea");
      await editTextarea.fill("Hello! Thank you for contacting support. We have updated your launch date to next Monday.");
      await manualDraftArticle.getByRole("button", { name: "Save edits" }).click();

      // Verify it reverted to Draft and approval is cleared
      await expect(manualDraftArticle.locator(".record-status[data-status='Draft']")).toBeVisible();
      await expect(manualDraftArticle).not.toContainText("Approved by");
      await expect(manualDraftArticle.getByRole("button", { name: /Approve draft/i })).toBeVisible();

      // 7. Verify activity history recorded draft events without leaking draft text
      await page.reload();
      const activitySection = page.locator("section").filter({ hasText: "Product history for this case" });
      await expect(activitySection).toBeVisible();
      // Wait for activity reload / entries
      await expect(activitySection.getByText(/Response draft created/i).first()).toBeVisible();
      await expect(activitySection.getByText(/Response draft #\d+ approved/i)).toBeVisible();
      await expect(activitySection.getByText(/Response draft #\d+ edited/i)).toBeVisible();
      // Ensure the sensitive draft message content is NOT leaked in the activity descriptions
      await expect(activitySection.locator(".case-activity-description")).not.toContainText([
        "We are reviewing your launch date.",
      ]);
    } finally {
      await deleteCaseViaApi(request, e2e.apiURL, work.id);
      await deleteCustomerViaApi(request, e2e.apiURL, customer.id);
    }
  });

  test("concurrency conflict preserves unsaved edits on version mismatch", async ({
    page,
    request,
    e2e,
  }) => {
    const marker = uniqueMarker("conflict");
    const customer = await createCustomerViaApi(request, e2e.apiURL, {
      name: `${marker} Customer`,
      email: `${marker}@example.com`,
    });
    const work = await createCaseViaApi(request, e2e.apiURL, {
      customerId: customer.id,
      title: `${marker} Concurrency Case`,
    });
    const draft = await createDraftViaApi(
      request,
      e2e.apiURL,
      work.id,
      "Initial text before external edit",
    );

    try {
      await page.goto(`/cases/${work.id}`);
      const draftArticle = page.getByRole("article", { name: new RegExp(`Response draft #${draft.id}`) });
      await expect(draftArticle).toBeVisible();

      // Open editor
      await draftArticle.getByRole("button", { name: /Edit/i }).click();
      const textarea = draftArticle.locator("textarea");
      await textarea.fill("My locally modified draft text that must not be lost!");

      // Simulate a concurrent update behind the scenes via API (bumping version to 2)
      const directUpdate = await request.put(`${e2e.apiURL}/api/cases/${work.id}/drafts/${draft.id}`, {
        headers: bearerHeaders(e2e),
        data: {
          content: "Concurrent text modified by another user",
          expectedVersion: draft.version,
        },
      });
      expect(directUpdate.ok()).toBeTruthy();

      // Now click Save edits on the page (which sends expectedVersion: 1)
      await draftArticle.getByRole("button", { name: "Save edits" }).click();

      // Concurrency conflict banner should appear
      await expect(draftArticle.locator(".draft-conflict-box")).toBeVisible();
      await expect(draftArticle).toContainText("Conflicting update detected");
      // The unsaved text MUST be preserved in the textarea!
      await expect(textarea).toHaveValue("My locally modified draft text that must not be lost!");

      // Click "Overwrite server with my edits"
      const overwriteBtn = draftArticle.getByRole("button", { name: /Overwrite server with my edits/i });
      await overwriteBtn.click();

      // Now the save should succeed and the draft should contain the overwritten local text
      await expect(draftArticle.locator(".draft-content-text")).toContainText(
        "My locally modified draft text that must not be lost!",
      );
    } finally {
      await deleteCaseViaApi(request, e2e.apiURL, work.id);
      await deleteCustomerViaApi(request, e2e.apiURL, customer.id);
    }
  });

  test("server enforces authentication and archived case restrictions", async ({
    request,
    e2e,
  }) => {
    const marker = uniqueMarker("security");
    const customer = await createCustomerViaApi(request, e2e.apiURL, {
      name: `${marker} Customer`,
      email: `${marker}@example.com`,
    });
    const work = await createCaseViaApi(request, e2e.apiURL, {
      customerId: customer.id,
      title: `${marker} Security Case`,
    });

    try {
      // 1. Unauthorized request (no token) -> 401
      const unauthGet = await request.get(`${e2e.apiURL}/api/cases/${work.id}/drafts`);
      expect(unauthGet.status()).toBe(401);

      const unauthPost = await request.post(`${e2e.apiURL}/api/cases/${work.id}/drafts`, {
        data: { content: "Unauthenticated attempt" },
      });
      expect(unauthPost.status()).toBe(401);

      // 2. Create a draft with auth
      const draft = await createDraftViaApi(request, e2e.apiURL, work.id, "Valid draft");

      // 3. Close and archive the case
      const closeRes = await request.put(`${e2e.apiURL}/api/cases/${work.id}`, {
        headers: bearerHeaders(e2e),
        data: {
          title: work.title,
          status: "Closed",
        },
      });
      expect(closeRes.ok()).toBeTruthy();

      const archiveRes = await request.post(`${e2e.apiURL}/api/cases/${work.id}/archive`, {
        headers: bearerHeaders(e2e),
      });
      expect(archiveRes.ok()).toBeTruthy();

      // 4. Try updating draft on archived case -> 409 Conflict
      const updateOnArchived = await request.put(`${e2e.apiURL}/api/cases/${work.id}/drafts/${draft.id}`, {
        headers: bearerHeaders(e2e),
        data: {
          content: "Attempted edit on archived case",
          expectedVersion: draft.version,
        },
      });
      expect(updateOnArchived.status()).toBe(409);

      // 5. Try approving draft on archived case -> 409 Conflict
      const approveOnArchived = await request.post(`${e2e.apiURL}/api/cases/${work.id}/drafts/${draft.id}/approve`, {
        headers: bearerHeaders(e2e),
        data: {
          approvedContent: draft.content,
          expectedVersion: draft.version,
        },
      });
      expect(approveOnArchived.status()).toBe(409);
    } finally {
      await deleteCaseViaApi(request, e2e.apiURL, work.id);
      await deleteCustomerViaApi(request, e2e.apiURL, customer.id);
    }
  });
});
