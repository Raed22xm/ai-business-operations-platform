import type { Locator, Page } from "@playwright/test";
import {
  confirmDeleteDialog,
  createCaseViaApi,
  createCustomerViaApi,
  createTaskViaApi,
  deleteCaseViaApi,
  deleteCustomerViaApi,
  deleteTaskViaApi,
  expect,
  test,
  uniqueMarker,
} from "./helpers";

/** Tab forward until `target` is focused (allows browser date-picker tab stops). */
async function tabUntilFocused(page: Page, target: Locator, maxTabs = 4): Promise<void> {
  for (let attempt = 0; attempt < maxTabs; attempt += 1) {
    if (await target.evaluate((element) => element === document.activeElement)) {
      await expect(target).toBeFocused();
      return;
    }
    await page.keyboard.press("Tab");
  }
  await expect(target).toBeFocused();
}

test.describe("case details tasks keyboard", () => {
  test("add/edit field order, delete success live region, and focus after delete", async ({
    page,
    request,
    e2e,
  }) => {
    const marker = uniqueMarker("taskkey");
    const customer = await createCustomerViaApi(request, e2e.apiURL, {
      name: `${marker} Owner`,
      email: `${marker}@example.com`,
    });
    const work = await createCaseViaApi(request, e2e.apiURL, {
      customerId: customer.id,
      title: `${marker} Case`,
    });
    const task = await createTaskViaApi(request, e2e.apiURL, {
      caseId: work.id,
      title: `${marker} Target`,
      description: "keyboard checks",
    });
    const createdIds: number[] = [task.id];

    try {
      await page.goto(`/cases/${work.id}`);
      await expect(page.getByRole("heading", { name: "Tasks", level: 2 })).toBeVisible();

      const addTask = page.getByRole("form", { name: "Add task" });
      await addTask.getByLabel("Title").focus();
      await expect(addTask.getByLabel("Title")).toBeFocused();
      await page.keyboard.press("Tab");
      await expect(addTask.getByLabel("Description")).toBeFocused();
      await page.keyboard.press("Tab");
      await expect(addTask.getByLabel("Due date")).toBeFocused();
      await tabUntilFocused(page, addTask.getByLabel("Priority"));
      await page.keyboard.press("Tab");
      await expect(addTask.getByRole("button", { name: "Add task" })).toBeFocused();

      await page.getByRole("button", { name: `Edit ${marker} Target` }).focus();
      await page.keyboard.press("Enter");
      const editForm = page.getByRole("form", { name: `Edit ${marker} Target` });
      await expect(editForm).toBeVisible();

      await editForm.getByLabel("Title").focus();
      await expect(editForm.getByLabel("Title")).toBeFocused();
      await page.keyboard.press("Tab");
      await expect(editForm.getByLabel("Description")).toBeFocused();
      await page.keyboard.press("Tab");
      await expect(editForm.getByLabel("Due date")).toBeFocused();
      await tabUntilFocused(page, editForm.getByLabel("Status"));
      await page.keyboard.press("Tab");
      await expect(editForm.getByLabel("Priority")).toBeFocused();
      await page.keyboard.press("Tab");
      await expect(editForm.getByRole("button", { name: "Save changes" })).toBeFocused();
      await page.keyboard.press("Tab");
      await expect(editForm.getByRole("button", { name: "Cancel" })).toBeFocused();
      await page.keyboard.press("Enter");
      await expect(editForm).toHaveCount(0);

      await page.getByRole("button", { name: `Delete ${marker} Target` }).click();
      await confirmDeleteDialog(page);

      const deleteNotice = page.getByRole("status").filter({
        hasText: `${marker} Target was deleted.`,
      });
      await expect(deleteNotice).toBeVisible();
      await expect(deleteNotice).toHaveAttribute("aria-live", "polite");
      await expect(page.getByRole("heading", { name: "Tasks", level: 2 })).toBeFocused();
      await expect(page.getByRole("row", { name: new RegExp(`${marker} Target`) })).toHaveCount(0);

      createdIds.splice(0, createdIds.length);
    } finally {
      for (const id of createdIds) {
        await deleteTaskViaApi(request, e2e.apiURL, id);
      }
      await deleteCaseViaApi(request, e2e.apiURL, work.id);
      await deleteCustomerViaApi(request, e2e.apiURL, customer.id);
    }
  });
});
