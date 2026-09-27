import {
  bearerHeaders,
  createCustomerViaApi,
  deleteCaseViaApi,
  deleteCustomerViaApi,
  expect,
  test,
  uniqueMarker,
} from "./helpers";

test.describe("internal customer inquiry intake", () => {
  test("unauthenticated access redirects to login", async ({ browser, e2e }) => {
    const context = await browser.newContext({
      baseURL: e2e.baseURL,
      storageState: { cookies: [], origins: [] },
    });
    const page = await context.newPage();
    await page.goto("/inquiry");
    await expect(page).toHaveURL(/\/login\?next=%2Finquiry/);
    await context.close();
  });

  test("new customer intake: validates inputs, creates customer and open case, redirects to case details", async ({
    page,
    request,
    e2e,
  }) => {
    const marker = uniqueMarker("new-inq");
    const email = `${marker}@example.com`;
    const customerName = `${marker} New Customer`;
    const company = `${marker} Industries`;
    const phone = "12345678";
    const caseTitle = `${marker} Website Redesign Request`;
    const caseDescription = "Customer needs full website modernization proposal.";

    const cleanupIds = { customerId: 0, caseId: 0 };

    try {
      await page.goto("/inquiry");
      await expect(page.getByRole("heading", { name: "New Customer Inquiry" })).toBeVisible();

      // 1. Test validation on empty submit
      const submitButton = page.getByRole("button", { name: /Save inquiry & open case/i });
      await submitButton.click();
      await expect(page.getByRole("alert").filter({ hasText: /required/i }).first()).toBeVisible();

      // 2. Fill email and trigger resolution
      const emailInput = page.getByLabel(/Customer email/i);
      await emailInput.fill(email);
      await emailInput.blur();

      // Verify resolver shows new customer message
      await expect(
        page.getByText(/No existing customer matches this email/i),
      ).toBeVisible({ timeout: 5000 });

      // 3. Fill customer and case fields
      await page.getByLabel(/^Customer name/i).fill(customerName);
      await page.getByLabel(/^Company/i).fill(company);
      await page.getByLabel(/^Phone/i).fill(phone);
      await page.getByLabel(/^Request title/i).fill(caseTitle);
      await page.getByLabel(/^Inquiry description/i).fill(caseDescription);

      // 4. Submit form
      await submitButton.click();

      // 5. Verify redirect to /cases/[id] with flash notice
      await page.waitForURL(/\/cases\/\d+/);
      const url = page.url();
      const match = url.match(/\/cases\/(\d+)/);
      expect(match).toBeTruthy();
      cleanupIds.caseId = Number(match![1]);

      await expect(page.getByRole("heading", { name: caseTitle })).toBeVisible();
      await expect(page.getByText(/Inquiry logged/i)).toBeVisible();

      // Verify case status is Open
      await expect(page.locator('.record-status[data-status="Open"]')).toBeVisible();

      // Verify case and customer in backend
      const caseResponse = await request.get(`${e2e.apiURL}/api/cases/${cleanupIds.caseId}`, {
        headers: bearerHeaders(e2e),
      });
      expect(caseResponse.ok()).toBeTruthy();
      const caseData = await caseResponse.json();
      expect(caseData.title).toBe(caseTitle);
      expect(caseData.description).toBe(caseDescription);
      expect(caseData.status).toBe("Open");
      cleanupIds.customerId = caseData.customerId;

      const customerResponse = await request.get(
        `${e2e.apiURL}/api/customers/${cleanupIds.customerId}`,
        { headers: bearerHeaders(e2e) },
      );
      expect(customerResponse.ok()).toBeTruthy();
      const customerData = await customerResponse.json();
      expect(customerData.name).toBe(customerName);
      expect(customerData.email).toBe(email);
      expect(customerData.company).toBe(company);

      // Verify case activity history records intake creation
      const activityResponse = await request.get(
        `${e2e.apiURL}/api/cases/${cleanupIds.caseId}/activity`,
        { headers: bearerHeaders(e2e) },
      );
      expect(activityResponse.ok()).toBeTruthy();
      const activitiesData = await activityResponse.json();
      const activityItems = Array.isArray(activitiesData) ? activitiesData : activitiesData.items;
      expect(activityItems.length).toBeGreaterThanOrEqual(1);
      expect(activityItems[0].eventType).toBe("CaseCreated");
      expect(activityItems[0].description).toContain("Inquiry intake");
    } finally {
      if (cleanupIds.caseId > 0) {
        await deleteCaseViaApi(request, e2e.apiURL, cleanupIds.caseId, e2e.accessToken);
      }
      if (cleanupIds.customerId > 0) {
        await deleteCustomerViaApi(request, e2e.apiURL, cleanupIds.customerId, e2e.accessToken);
      }
    }
  });

  test("existing customer match: resolves, avoids profile overwrite, links case, prevents duplicates", async ({
    page,
    request,
    e2e,
  }) => {
    const marker = uniqueMarker("exist-inq");
    const email = `${marker}@example.com`;
    const originalName = `${marker} Original Client`;
    const originalCompany = `${marker} Enterprises`;

    // 1. Pre-create existing customer
    const createdCustomer = await createCustomerViaApi(
      request,
      e2e.apiURL,
      {
        name: originalName,
        email,
        company: originalCompany,
        phone: "555-4321",
      },
      e2e.accessToken,
    );

    const cleanupCaseIds: number[] = [];

    try {
      await page.goto("/inquiry");
      const emailInput = page.getByLabel(/Customer email/i);
      await emailInput.fill(email.toUpperCase()); // Test case-insensitive resolution
      await emailInput.blur();

      // Verify resolution displays existing match
      await expect(
        page.getByText(/Existing customer record found for this email/i),
      ).toBeVisible({ timeout: 5000 });
      await expect(page.getByRole("strong").filter({ hasText: originalName })).toBeVisible();

      // Fill inquiry title
      const caseTitle = `${marker} Urgent Server Maintenance`;
      await page.getByLabel(/^Request title/i).fill(caseTitle);

      // Submit form
      await page.getByRole("button", { name: /Save inquiry & open case/i }).click();

      // Verify redirect to case
      await page.waitForURL(/\/cases\/\d+/);
      const url = page.url();
      const match = url.match(/\/cases\/(\d+)/);
      expect(match).toBeTruthy();
      const firstCaseId = Number(match![1]);
      cleanupCaseIds.push(firstCaseId);

      // Verify case linked to existing customer without modifying customer data
      const customerCheck = await request.get(
        `${e2e.apiURL}/api/customers/${createdCustomer.id}`,
        { headers: bearerHeaders(e2e) },
      );
      const customerData = await customerCheck.json();
      expect(customerData.name).toBe(originalName);
      expect(customerData.company).toBe(originalCompany);

      // 2. Duplicate submission test: retry same customer and title within 2 minutes
      await page.goto("/inquiry");
      const emailInput2 = page.getByLabel(/Customer email/i);
      await emailInput2.fill(email);
      await emailInput2.blur();

      await expect(page.getByRole("strong").filter({ hasText: originalName })).toBeVisible({ timeout: 5000 });
      await page.getByLabel(/^Request title/i).fill(caseTitle);

      await page.getByRole("button", { name: /Save inquiry & open case/i }).click();

      // Should show duplicate inquiry conflict alert
      await expect(
        page.getByRole("alert").filter({ hasText: /identical case for this customer was submitted/i }),
      ).toBeVisible({ timeout: 5000 });

      // Verify title is preserved in form
      await expect(page.getByLabel(/^Request title/i)).toHaveValue(caseTitle);
    } finally {
      for (const id of cleanupCaseIds) {
        await deleteCaseViaApi(request, e2e.apiURL, id, e2e.accessToken);
      }
      await deleteCustomerViaApi(request, e2e.apiURL, createdCustomer.id, e2e.accessToken);
    }
  });

  test("multiple matches: requires explicit selection or new confirmation", async ({
    page,
    request,
    e2e,
  }) => {
    const marker = uniqueMarker("multi-inq");
    const sharedEmail = `${marker}@example.com`;

    const cust1 = await createCustomerViaApi(
      request,
      e2e.apiURL,
      { name: `${marker} Branch North`, email: sharedEmail, company: "North Branch" },
      e2e.accessToken,
    );
    const cust2 = await createCustomerViaApi(
      request,
      e2e.apiURL,
      { name: `${marker} Branch South`, email: sharedEmail, company: "South Branch" },
      e2e.accessToken,
    );

    let createdCaseId = 0;

    try {
      await page.goto("/inquiry");
      const emailInput = page.getByLabel(/Customer email/i);
      await emailInput.fill(sharedEmail);
      await emailInput.blur();

      // Verify multiple matches banner appears
      await expect(
        page.getByText(/Multiple customer profiles \(2\) share this email/i),
      ).toBeVisible({ timeout: 5000 });

      await expect(page.getByText(`${marker} Branch North`)).toBeVisible();
      await expect(page.getByText(`${marker} Branch South`)).toBeVisible();

      // Select Branch South
      const branchSouthOption = page.locator("label").filter({ hasText: `${marker} Branch South` });
      await branchSouthOption.click();

      const caseTitle = `${marker} Branch Equipment Inquiry`;
      await page.getByLabel(/^Request title/i).fill(caseTitle);

      await page.getByRole("button", { name: /Save inquiry & open case/i }).click();

      await page.waitForURL(/\/cases\/\d+/);
      const url = page.url();
      const match = url.match(/\/cases\/(\d+)/);
      expect(match).toBeTruthy();
      createdCaseId = Number(match![1]);

      // Verify case is linked to cust2 (Branch South)
      const caseCheck = await request.get(`${e2e.apiURL}/api/cases/${createdCaseId}`, {
        headers: bearerHeaders(e2e),
      });
      const caseJson = await caseCheck.json();
      expect(caseJson.customerId).toBe(cust2.id);
    } finally {
      if (createdCaseId > 0) {
        await deleteCaseViaApi(request, e2e.apiURL, createdCaseId, e2e.accessToken);
      }
      await deleteCustomerViaApi(request, e2e.apiURL, cust1.id, e2e.accessToken);
      await deleteCustomerViaApi(request, e2e.apiURL, cust2.id, e2e.accessToken);
    }
  });

  test("mobile layout and keyboard navigation accessibility", async ({ page }) => {
    // 1. Mobile viewport check
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/inquiry");
    await expect(page.getByRole("heading", { name: "New Customer Inquiry" })).toBeVisible();

    const submitBtn = page.getByRole("button", { name: /Save inquiry & open case/i });
    await expect(submitBtn).toBeVisible();

    // 2. Keyboard navigation test
    const emailField = page.getByLabel(/Customer email/i);
    await emailField.focus();
    await expect(emailField).toBeFocused();

    // Tab through to title field
    await page.keyboard.press("Tab");
    // Next tabbable field is customerName
    const nameField = page.getByLabel(/Customer name/i);
    await expect(nameField).toBeFocused();

    await page.keyboard.press("Tab");
    const companyField = page.getByLabel(/Company/i);
    await expect(companyField).toBeFocused();

    await page.keyboard.press("Tab");
    const phoneField = page.getByLabel(/Phone/i);
    await expect(phoneField).toBeFocused();

    await page.keyboard.press("Tab");
    const titleField = page.getByLabel(/Request title/i);
    await expect(titleField).toBeFocused();

    await page.keyboard.type("Keyboard Accessible Inquiry");
    await expect(titleField).toHaveValue("Keyboard Accessible Inquiry");
  });
});
