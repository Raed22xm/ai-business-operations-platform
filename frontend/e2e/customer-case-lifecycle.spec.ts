import {
  confirmDeleteDialog,
  deleteCaseViaApi,
  deleteCustomerViaApi,
  expect,
  fillCustomerForm,
  test,
  uniqueMarker,
} from "./helpers";

test.describe("customer and case lifecycle", () => {
  test("create, edit, conflict delete, then clean up through the UI", async ({
    page,
    request,
    e2e,
  }) => {
    const marker = uniqueMarker("life");
    const customerName = `${marker} Customer`;
    const caseTitle = `${marker} Case`;
    const editedTitle = `${marker} Case Edited`;

    const createdIds = { customerId: 0, caseId: 0 };

    try {
      await page.goto("/customers");
      await expect(page.getByRole("heading", { name: "Customers" })).toBeVisible();

      await fillCustomerForm(page, {
        name: customerName,
        email: `${marker}@example.com`,
        company: `${marker} Co`,
      });
      await page.getByRole("form", { name: "Add customer" }).getByRole("button", { name: "Add customer" }).click();
      await expect(page.getByRole("link", { name: customerName })).toBeVisible();

      const customerResponse = await request.get(
        `${e2e.apiURL}/api/customers?search=${encodeURIComponent(marker)}`,
      );
      expect(customerResponse.ok()).toBeTruthy();
      const customers = (await customerResponse.json()) as Array<{ id: number; name: string }>;
      const customer = customers.find((row) => row.name === customerName);
      expect(customer).toBeTruthy();
      createdIds.customerId = customer!.id;

      await page.goto("/cases");
      await expect(page.getByRole("heading", { name: "Cases", exact: true })).toBeVisible();

      const addCase = page.getByRole("form", { name: "Add case" });
      await addCase.getByLabel("Customer").selectOption({ label: customerName });
      await addCase.getByLabel("Title").fill(caseTitle);
      await addCase.getByLabel("Description").fill("Created by browser e2e");
      await addCase.getByRole("button", { name: "Add case" }).click();
      await expect(page.getByRole("link", { name: caseTitle })).toBeVisible();

      const casesResponse = await request.get(
        `${e2e.apiURL}/api/cases?customerId=${createdIds.customerId}&search=${encodeURIComponent(marker)}`,
      );
      expect(casesResponse.ok()).toBeTruthy();
      const cases = (await casesResponse.json()) as Array<{ id: number; title: string }>;
      const work = cases.find((row) => row.title === caseTitle);
      expect(work).toBeTruthy();
      createdIds.caseId = work!.id;

      await page.getByRole("button", { name: `Edit ${caseTitle}` }).click();
      const editForm = page.getByRole("form", { name: `Edit ${caseTitle}` });
      await editForm.getByLabel("Title").fill(editedTitle);
      await editForm.getByLabel("Status").selectOption("InProgress");
      await editForm.getByRole("button", { name: "Save changes" }).click();
      await expect(page.getByRole("status").filter({ hasText: /updated/i })).toBeVisible();
      await expect(page.getByRole("link", { name: editedTitle })).toBeVisible();

      await page.reload();
      await expect(page.getByRole("link", { name: editedTitle })).toBeVisible();
      await expect(page.getByRole("row", { name: new RegExp(editedTitle) })).toContainText(
        "In progress",
      );

      await page.goto("/customers");
      await page.getByLabel("Search", { exact: true }).fill(marker);
      await page.getByRole("button", { name: "Search", exact: true }).click();
      await expect(page.getByRole("link", { name: customerName })).toBeVisible();
      await page.getByRole("button", { name: `Delete ${customerName}` }).click();
      await confirmDeleteDialog(page);
      await expect(
        page.getByRole("alert").filter({ hasText: /has cases and cannot be deleted/i }),
      ).toBeVisible();
      await expect(page.getByRole("link", { name: customerName })).toBeVisible();

      await page.goto(`/cases?customerId=${createdIds.customerId}`);
      await page.getByRole("button", { name: `Delete ${editedTitle}` }).click();
      await confirmDeleteDialog(page);
      await expect(page.getByRole("status")).toContainText(`${editedTitle} was deleted.`);
      await expect(page.getByRole("link", { name: editedTitle })).toHaveCount(0);
      createdIds.caseId = 0;

      await page.goto("/customers");
      await page.getByLabel("Search", { exact: true }).fill(marker);
      await page.getByRole("button", { name: "Search", exact: true }).click();
      await page.getByRole("button", { name: `Delete ${customerName}` }).click();
      await confirmDeleteDialog(page);
      await expect(page.getByRole("status")).toContainText(`${customerName} was deleted.`);
      await expect(page.getByRole("link", { name: customerName })).toHaveCount(0);
      createdIds.customerId = 0;
    } finally {
      if (createdIds.caseId) {
        await deleteCaseViaApi(request, e2e.apiURL, createdIds.caseId);
      }
      if (createdIds.customerId) {
        await deleteCustomerViaApi(request, e2e.apiURL, createdIds.customerId);
      }
    }
  });
});
