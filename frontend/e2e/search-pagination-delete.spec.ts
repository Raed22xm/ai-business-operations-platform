import {
  confirmDeleteDialog,
  createCaseViaApi,
  createCustomerViaApi,
  deleteCaseViaApi,
  deleteCustomerViaApi,
  expect,
  test,
  uniqueMarker,
} from "./helpers";

test.describe("search, filters, and delete feedback", () => {
  test("customer search resets pagination to page 1", async ({ page, request, e2e }) => {
    const marker = uniqueMarker("pagecust");
    const created: number[] = [];

    try {
      for (let index = 1; index <= 21; index += 1) {
        const customer = await createCustomerViaApi(request, e2e.apiURL, {
          name: `${marker} ${String(index).padStart(2, "0")}`,
          email: `${marker}-${index}@example.com`,
        });
        created.push(customer.id);
      }

      await page.goto(`/customers?search=${encodeURIComponent(marker)}&page=2`);
      await expect(page.getByRole("navigation", { name: "Pagination" })).toContainText(
        /Showing 21–21 of 21/,
      );
      expect(page.url()).toContain("page=2");

      await page.getByLabel("Search", { exact: true }).fill(`${marker} 01`);
      await page.getByRole("button", { name: "Search", exact: true }).click();

      await expect(page.getByRole("link", { name: `${marker} 01` })).toBeVisible();
      expect(page.url()).not.toContain("page=");
      await expect(page.getByRole("navigation", { name: "Pagination" })).toContainText(
        /Showing 1–1 of 1/,
      );
    } finally {
      for (const id of created) {
        await deleteCustomerViaApi(request, e2e.apiURL, id);
      }
    }
  });

  test("case filter changes reset pagination to page 1", async ({ page, request, e2e }) => {
    const marker = uniqueMarker("pagecase");
    const customer = await createCustomerViaApi(request, e2e.apiURL, {
      name: `${marker} Owner`,
      email: `${marker}@example.com`,
    });
    const caseIds: number[] = [];

    try {
      for (let index = 1; index <= 21; index += 1) {
        const work = await createCaseViaApi(request, e2e.apiURL, {
          customerId: customer.id,
          title: `${marker} Case ${String(index).padStart(2, "0")}`,
          description: "pagination filter seed",
        });
        caseIds.push(work.id);
      }

      await page.goto(
        `/cases?customerId=${customer.id}&search=${encodeURIComponent(marker)}&page=2`,
      );
      await expect(page.getByRole("navigation", { name: "Pagination" })).toContainText(
        /Showing 21–21 of 21/,
      );
      expect(page.url()).toContain("page=2");

      await page.getByLabel("Status").selectOption("Open");
      await expect
        .poll(() => page.url())
        .not.toContain("page=2");
      expect(page.url()).toContain(`customerId=${customer.id}`);
      expect(page.url()).toContain("status=Open");
    } finally {
      for (const id of caseIds) {
        await deleteCaseViaApi(request, e2e.apiURL, id);
      }
      await deleteCustomerViaApi(request, e2e.apiURL, customer.id);
    }
  });

  test("deleting the only row on the last page shows success feedback", async ({
    page,
    request,
    e2e,
  }) => {
    const marker = uniqueMarker("lastrow");
    const created: Array<{ id: number; name: string }> = [];

    try {
      for (let index = 1; index <= 21; index += 1) {
        const customer = await createCustomerViaApi(request, e2e.apiURL, {
          name: `${marker} ${String(index).padStart(2, "0")}`,
          email: `${marker}-${index}@example.com`,
        });
        created.push(customer);
      }

      await page.goto(`/customers?search=${encodeURIComponent(marker)}&page=2`);
      await expect(page.getByRole("navigation", { name: "Pagination" })).toContainText(
        /Showing 21–21 of 21/,
      );
      const soleName = (
        await page.getByRole("table").getByRole("link").first().textContent()
      )?.trim();
      expect(soleName).toBeTruthy();
      expect(soleName).toContain(marker);

      await page.getByRole("button", { name: `Delete ${soleName}` }).click();
      await confirmDeleteDialog(page);

      await expect(
        page.getByRole("status").filter({ hasText: `${soleName} was deleted.` }),
      ).toBeVisible();
      const landed = new URL(page.url());
      expect(landed.searchParams.get("search")).toBe(marker);
      expect(landed.searchParams.get("page")).toBeNull();
      expect(landed.searchParams.get("notice")).toBeNull();
      await expect(page.getByRole("link", { name: soleName!, exact: true })).toHaveCount(0);

      const remaining = created.filter((row) => row.name !== soleName);
      for (const row of remaining) {
        await deleteCustomerViaApi(request, e2e.apiURL, row.id);
      }
      created.length = 0;
    } finally {
      for (const row of created) {
        await deleteCustomerViaApi(request, e2e.apiURL, row.id);
      }
    }
  });
});
