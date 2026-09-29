import {
  test,
  expect,
  createCustomerViaApi,
  createCaseViaApi,
  deleteCaseViaApi,
  deleteCustomerViaApi,
  uniqueMarker,
} from "./helpers";

test("customer details: delete button opens safety modal, supports cancel, deletes and redirects", async ({
  page,
  request,
  e2e,
}) => {
  const marker = uniqueMarker("cust-del");
  let customerId = 0;

  try {
    // 1. Create a customer with no cases
    const customer = await createCustomerViaApi(request, e2e.apiURL, {
      name: `${marker} Deletable Client`,
      email: `${marker}@example.com`,
    });
    customerId = customer.id;

    // 2. Open customer details
    await page.goto(`${e2e.baseURL}/customers/${customer.id}`);

    // 3. Verify Delete button exists
    const deleteButton = page.getByRole("button", { name: `Delete customer ${customer.name}` });
    await expect(deleteButton).toBeVisible();

    // 4. Click Delete to open confirmation dialog
    await deleteButton.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("heading", { name: `Delete ${customer.name}?` })).toBeVisible();

    // 5. Test Cancel button closes dialog without deleting
    const cancelButton = dialog.getByRole("button", { name: "Cancel" });
    await cancelButton.click();
    await expect(dialog).not.toBeVisible();
    await expect(page).toHaveURL(`${e2e.baseURL}/customers/${customer.id}`);

    // 6. Click Delete again and confirm deletion
    await deleteButton.click();
    await expect(dialog).toBeVisible();
    const confirmDeleteBtn = dialog.getByRole("button", { name: "Delete", exact: true });
    await confirmDeleteBtn.click();

    // 7. Verify redirect to /customers with flash banner
    await expect(page).toHaveURL(/customers/);
    await expect(page.getByText(`${customer.name} was deleted.`)).toBeVisible();

    // Marked as deleted so cleanup won't fail
    customerId = 0;
  } finally {
    if (customerId > 0) {
      await deleteCustomerViaApi(request, e2e.apiURL, customerId);
    }
  }
});

test("customer details: delete safety blocks deletion when customer has open cases", async ({
  page,
  request,
  e2e,
}) => {
  const marker = uniqueMarker("del-blocked");
  let customerId = 0;
  let caseId = 0;

  try {
    // 1. Create a customer and an attached case
    const customer = await createCustomerViaApi(request, e2e.apiURL, {
      name: `${marker} Protected Client`,
      email: `${marker}@example.com`,
    });
    customerId = customer.id;

    const work = await createCaseViaApi(request, e2e.apiURL, {
      customerId: customer.id,
      title: `${marker} Active Project`,
    });
    caseId = work.id;

    // 2. Open customer details
    await page.goto(`${e2e.baseURL}/customers/${customer.id}`);

    // 3. Attempt to delete
    const deleteButton = page.getByRole("button", { name: `Delete customer ${customer.name}` });
    await deleteButton.click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    const confirmDeleteBtn = dialog.getByRole("button", { name: "Delete", exact: true });
    await confirmDeleteBtn.click();

    // 4. Verify conflict error message is rendered
    await expect(dialog.getByRole("alert")).toBeVisible();
    await expect(
      dialog.getByText("This customer has cases and cannot be deleted."),
    ).toBeVisible();

    // Close modal
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).not.toBeVisible();
  } finally {
    if (caseId > 0) {
      await deleteCaseViaApi(request, e2e.apiURL, caseId);
    }
    if (customerId > 0) {
      await deleteCustomerViaApi(request, e2e.apiURL, customerId);
    }
  }
});
