import { test, expect, createCustomerViaApi, createCaseViaApi, deleteCaseViaApi, deleteCustomerViaApi, bearerHeaders } from "./helpers";

test("customers and cases CSV export respect filters and stay read-only", async ({ page, request, e2e }) => {
  const customers: number[] = [];
  const cases: number[] = [];
  try {
    const marker = `csv-e2e-${Date.now()}`;
    const match = await createCustomerViaApi(request, e2e.apiURL, {
      name: `${marker} Match`,
      email: `${marker}.match@example.com`,
      phone: "=1+1",
      company: 'Acme, "Labs"',
    });
    customers.push(match.id);
    const other = await createCustomerViaApi(request, e2e.apiURL, {
      name: `${marker} Other`,
      email: `${marker}.other@example.com`,
    });
    customers.push(other.id);

    const work = await createCaseViaApi(request, e2e.apiURL, {
      customerId: match.id,
      title: `${marker} case title`,
      description: "Export me",
    });
    cases.push(work.id);
    const otherCase = await createCaseViaApi(request, e2e.apiURL, {
      customerId: other.id,
      title: `${marker} other case`,
      description: "Skip",
    });
    cases.push(otherCase.id);

    await page.goto(`${e2e.baseURL}/customers?search=${encodeURIComponent(`${marker} Match`)}`);
    await expect(page.getByRole("button", { name: "Export CSV" })).toBeVisible();
    await expect(page.getByText(/matching the current filters/i)).toBeVisible();

    const customerExport = await page.request.get(
      `${e2e.baseURL}/customers/export?search=${encodeURIComponent(`${marker} Match`)}`,
    );
    expect(customerExport.ok()).toBeTruthy();
    const customerCsv = await customerExport.text();
    expect(customerCsv).toContain("Id,Name,Email,Phone,Company,Created At (UTC)");
    expect(customerCsv).toContain(`${marker} Match`);
    expect(customerCsv).not.toContain(`${marker} Other`);
    expect(customerCsv).toContain("'=1+1");

    const stillThere = await request.get(`${e2e.apiURL}/api/customers/${match.id}`, {
      headers: bearerHeaders(e2e),
    });
    expect(stillThere.ok()).toBeTruthy();

    await page.goto(
      `${e2e.baseURL}/cases?customerId=${match.id}&search=${encodeURIComponent(marker)}`,
    );
    await expect(page.getByRole("button", { name: "Export CSV" })).toBeVisible();

    const caseExport = await page.request.get(
      `${e2e.baseURL}/cases/export?customerId=${match.id}&search=${encodeURIComponent(marker)}`,
    );
    expect(caseExport.ok()).toBeTruthy();
    const caseCsv = await caseExport.text();
    expect(caseCsv).toContain(
      "Id,Customer Id,Customer Name,Title,Description,Status,Created At (UTC),Archived At (UTC)",
    );
    expect(caseCsv).toContain(`${marker} case title`);
    expect(caseCsv).not.toContain(`${marker} other case`);
    expect(caseCsv).toContain(`${marker} Match`);

    const anon = await request.get(`${e2e.apiURL}/api/customers/export`);
    expect(anon.status()).toBe(401);
  } finally {
    for (const id of cases) await deleteCaseViaApi(request, e2e.apiURL, id);
    for (const id of customers) await deleteCustomerViaApi(request, e2e.apiURL, id);
  }
});

test("customers and cases CSV export support date-range and status filters", async ({ page, request, e2e }) => {
  const customers: number[] = [];
  const cases: number[] = [];
  try {
    const marker = `date-csv-${Date.now()}`;
    const cust = await createCustomerViaApi(request, e2e.apiURL, {
      name: `${marker} Customer`,
      email: `${marker}@example.com`,
    });
    customers.push(cust.id);

    const work = await createCaseViaApi(request, e2e.apiURL, {
      customerId: cust.id,
      title: `${marker} case open`,
      description: "Active work",
    });
    cases.push(work.id);

    const today = new Date().toISOString().slice(0, 10);
    const pastFrom = "2020-01-01";
    const pastTo = "2020-01-02";

    // 1. Exporting with today's range includes the record
    const customerToday = await page.request.get(
      `${e2e.baseURL}/customers/export?search=${encodeURIComponent(marker)}&fromDate=${today}&toDate=${today}`,
    );
    expect(customerToday.ok()).toBeTruthy();
    expect(await customerToday.text()).toContain(`${marker} Customer`);

    // 2. Exporting with out-of-range dates excludes the record
    const customerPast = await page.request.get(
      `${e2e.baseURL}/customers/export?search=${encodeURIComponent(marker)}&fromDate=${pastFrom}&toDate=${pastTo}`,
    );
    expect(customerPast.ok()).toBeTruthy();
    expect(await customerPast.text()).not.toContain(`${marker} Customer`);

    // 3. Invalid date range (fromDate > toDate) returns 400
    const customerInvalid = await page.request.get(
      `${e2e.baseURL}/customers/export?fromDate=2026-12-31&toDate=2026-01-01`,
    );
    expect(customerInvalid.status()).toBe(400);

    // 4. Case export with status and date range
    const caseToday = await page.request.get(
      `${e2e.baseURL}/cases/export?customerId=${cust.id}&status=Open&fromDate=${today}&toDate=${today}`,
    );
    expect(caseToday.ok()).toBeTruthy();
    expect(await caseToday.text()).toContain(`${marker} case open`);

    // 5. Case export with mismatched status (Closed) excludes Open case
    const caseClosed = await page.request.get(
      `${e2e.baseURL}/cases/export?customerId=${cust.id}&status=Closed&fromDate=${today}&toDate=${today}`,
    );
    expect(caseClosed.ok()).toBeTruthy();
    expect(await caseClosed.text()).not.toContain(`${marker} case open`);

    // 6. Test UI date inputs on /customers and verify export link href updates
    await page.goto(`${e2e.baseURL}/customers`);
    await expect(page.locator("#customer-from-date")).toBeVisible();
    await page.locator("#customer-from-date").fill(today);
    await expect(page.locator("#customer-from-date")).toHaveValue(today);
    await page.locator("#customer-to-date").fill(today);
    await expect(page.locator("#customer-to-date")).toHaveValue(today);
    await page.locator(".crm-filters").getByRole("button", { name: "Search", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`fromDate=${today}`));
    await expect(page).toHaveURL(new RegExp(`toDate=${today}`));

    // 7. Test UI date inputs on /cases and verify export link href updates
    await page.goto(`${e2e.baseURL}/cases`);
    await expect(page.locator("#case-from-date")).toBeVisible();
    await page.locator("#case-from-date").fill(today);
    await expect(page.locator("#case-from-date")).toHaveValue(today);
    await page.locator("#case-to-date").fill(today);
    await expect(page.locator("#case-to-date")).toHaveValue(today);
    await page.locator(".crm-filters").getByRole("button", { name: "Search", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`fromDate=${today}`));
    await expect(page).toHaveURL(new RegExp(`toDate=${today}`));
  } finally {
    for (const id of cases) await deleteCaseViaApi(request, e2e.apiURL, id);
    for (const id of customers) await deleteCustomerViaApi(request, e2e.apiURL, id);
  }
});
