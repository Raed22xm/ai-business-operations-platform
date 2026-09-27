import {
  test,
  expect,
  createCustomerViaApi,
  deleteCustomerViaApi,
  bearerHeaders,
  uniqueMarker,
} from "./helpers";

test("customer notes CRUD, validation, pagination, access control, and mobile layout", async ({
  page,
  request,
  e2e,
}) => {
  const customers: number[] = [];
  try {
    const marker = uniqueMarker("notes-e2e");
    const customer = await createCustomerViaApi(request, e2e.apiURL, {
      name: `${marker} Customer`,
      email: `${marker}@example.com`,
    });
    customers.push(customer.id);

    // Unauthenticated notes API rejected.
    const anon = await request.get(`${e2e.apiURL}/api/customers/${customer.id}/notes`);
    expect(anon.status()).toBe(401);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${e2e.baseURL}/customers/${customer.id}`);

    await expect(page.getByRole("heading", { name: "Notes", exact: true })).toBeVisible();
    await expect(page.getByText("No notes yet for this customer.")).toBeVisible();

    const addForm = page.getByRole("form", { name: "Add note" });
    await expect(addForm).toBeVisible();

    // Blank content rejected; entered text preserved.
    await addForm.getByRole("button", { name: "Add note" }).click();
    await expect(addForm.getByRole("alert")).toBeVisible();
    await addForm.getByLabel("Note").fill("   ");
    await addForm.getByRole("button", { name: "Add note" }).click();
    await expect(addForm.getByRole("alert")).toBeVisible();
    await expect(addForm.getByLabel("Note")).toHaveValue("   ");

    const firstContent = `${marker} first note\nSecond line <script>alert(1)</script>`;
    await addForm.getByLabel("Note").fill(firstContent);
    await addForm.getByRole("button", { name: "Add note" }).click();
    await expect(page.getByText("Note was added.")).toBeVisible();
    await expect(page.getByText(`${marker} first note`)).toBeVisible();
    await expect(page.getByText("<script>alert(1)</script>")).toBeVisible();
    // Rendered as text, not executed HTML.
    await expect(page.locator("script", { hasText: "alert(1)" })).toHaveCount(0);

    // Seed enough notes via API for Load more (page size 10).
    for (let i = 0; i < 10; i += 1) {
      const response = await request.post(
        `${e2e.apiURL}/api/customers/${customer.id}/notes`,
        {
          headers: bearerHeaders(e2e),
          data: { content: `${marker} bulk ${i + 1}` },
        },
      );
      expect(response.ok()).toBeTruthy();
    }

    await page.reload();
    await expect(page.getByRole("button", { name: "Load more" })).toBeVisible();
    await page.getByRole("button", { name: "Load more" }).click();
    await expect(page.getByText(`${marker} first note`)).toBeVisible();
    await expect(page.getByText(/Showing \d+ of \d+ notes/)).toBeVisible();

    // Edit preserves author/created; cancel works.
    await page.setViewportSize({ width: 1440, height: 960 });
    await page
      .locator("li")
      .filter({ hasText: `${marker} bulk 10` })
      .first()
      .getByRole("button", { name: /^Edit note/ })
      .click();
    const editForm = page.getByRole("form", { name: "Edit note" });
    await expect(editForm).toBeVisible();
    await editForm.getByRole("textbox", { name: "Note" }).fill(`${marker} edited bulk`);
    await editForm.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByText(`${marker} bulk 10`)).toBeVisible();

    await page
      .locator("li")
      .filter({ hasText: `${marker} bulk 10` })
      .first()
      .getByRole("button", { name: /^Edit note/ })
      .click();
    await page
      .getByRole("form", { name: "Edit note" })
      .getByRole("textbox", { name: "Note" })
      .fill(`${marker} edited bulk`);
    await page.getByRole("form", { name: "Edit note" }).getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Note was updated.")).toBeVisible();
    await expect(page.getByText(`${marker} edited bulk`)).toBeVisible();
    await expect(page.getByText(/Edited /)).toBeVisible();

    // Confirmed delete.
    const deleteTarget = page
      .locator("li")
      .filter({ hasText: `${marker} edited bulk` })
      .first();
    await deleteTarget.getByRole("button", { name: /^Delete note/ }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: /Delete / })).toBeVisible();
    await dialog.getByRole("button", { name: "Delete", exact: true }).click();
    await expect(page.getByText(/was deleted\./)).toBeVisible();
    await expect(page.getByText(`${marker} edited bulk`)).toHaveCount(0);

    // Protected fields ignored on create via API.
    const spoof = await request.post(`${e2e.apiURL}/api/customers/${customer.id}/notes`, {
      headers: bearerHeaders(e2e),
      data: {
        id: 99999,
        customerId: 0,
        content: `${marker} protected`,
        authorName: "intruder",
        createdAt: "2000-01-01T00:00:00Z",
        updatedAt: "2000-01-01T00:00:00Z",
      },
    });
    expect(spoof.status()).toBe(201);
    const body = (await spoof.json()) as {
      id: number;
      authorName: string;
      updatedAt: string | null;
      createdAt: string;
    };
    expect(body.id).not.toBe(99999);
    expect(body.authorName).not.toBe("intruder");
    expect(body.updatedAt).toBeNull();
    expect(body.createdAt.startsWith("2000")).toBeFalsy();

    // Notes excluded from customer CSV.
    const csv = await page.request.get(`${e2e.baseURL}/customers/export`);
    expect(csv.ok()).toBeTruthy();
    const csvText = await csv.text();
    expect(csvText).not.toContain(`${marker} protected`);
    expect(csvText).not.toContain("AuthorName");
  } finally {
    for (const id of customers) await deleteCustomerViaApi(request, e2e.apiURL, id);
  }
});
