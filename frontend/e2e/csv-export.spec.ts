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
