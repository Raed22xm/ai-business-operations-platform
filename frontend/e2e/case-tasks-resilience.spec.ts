import {
  confirmDeleteDialog,
  createCaseViaApi,
  createCustomerViaApi,
  createTaskViaApi,
  deleteCaseViaApi,
  deleteCustomerViaApi,
  deleteTaskViaApi,
  bearerHeaders,
  expect,
  test,
  uniqueMarker,
} from "./helpers";
import type { Locator } from "@playwright/test";
import { clearApiMock, setApiMock } from "./api-mock";

/** Select a task status in a way that updates React controlled state. */
async function selectTaskStatus(
  select: Locator,
  value: "Todo" | "InProgress" | "Done",
): Promise<void> {
  await select.evaluate((element, nextValue) => {
    const node = element as HTMLSelectElement;
    node.value = nextValue;
    node.dispatchEvent(new Event("input", { bubbles: true }));
    node.dispatchEvent(new Event("change", { bubbles: true }));
  }, value);
  await expect(select).toHaveValue(value);
}
test.describe("case details tasks resilience", () => {
  test.afterEach(async () => {
    await clearApiMock();
  });

  test("empty state, delayed load, load failure with retry, and dialog focus", async ({
    page,
    request,
    e2e,
  }) => {
    const marker = uniqueMarker("taskres");
    const customer = await createCustomerViaApi(request, e2e.apiURL, {
      name: `${marker} Owner`,
      email: `${marker}@example.com`,
    });
    const emptyCase = await createCaseViaApi(request, e2e.apiURL, {
      customerId: customer.id,
      title: `${marker} Empty`,
    });
    const delayedCase = await createCaseViaApi(request, e2e.apiURL, {
      customerId: customer.id,
      title: `${marker} Delayed`,
    });
    const failCase = await createCaseViaApi(request, e2e.apiURL, {
      customerId: customer.id,
      title: `${marker} FailLoad`,
    });
    const focusTask = await createTaskViaApi(request, e2e.apiURL, {
      caseId: failCase.id,
      title: `${marker} Focus`,
    });

    try {
      await page.goto(`/cases/${emptyCase.id}`);
      await expect(page.getByRole("heading", { name: `${marker} Empty`, level: 1 })).toBeVisible();
      await expect(page.getByText("No tasks for this case yet.")).toBeVisible();
      await expect(page.getByRole("form", { name: "Add task" })).toBeVisible();

      await setApiMock([
        {
          method: "GET",
          pathPrefix: "/api/tasks",
          delayMs: 2500,
          once: true,
        },
      ]);
      const delayedNav = page.goto(`/cases/${delayedCase.id}`, { waitUntil: "commit" });
      await expect(page.getByRole("heading", { name: `${marker} Delayed`, level: 1 })).toBeVisible({
        timeout: 15_000,
      });
      await expect(page.getByRole("status").filter({ hasText: "Loading tasks…" })).toBeVisible({
        timeout: 5_000,
      });
      await delayedNav;
      await expect(page.getByText("No tasks for this case yet.")).toBeVisible({ timeout: 15_000 });
      await expect(page.getByRole("heading", { name: `${marker} Delayed`, level: 1 })).toBeVisible();

      await setApiMock([
        {
          method: "GET",
          pathPrefix: "/api/tasks",
          status: 500,
          body: JSON.stringify({ title: "Mocked task list failure" }),
          once: true,
        },
      ]);
      await page.goto(`/cases/${failCase.id}`);
      await expect(page.getByRole("heading", { name: `${marker} FailLoad`, level: 1 })).toBeVisible();
      await expect(
        page.getByRole("alert").filter({ hasText: /Could not load tasks for this case/i }),
      ).toBeVisible();
      await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
      await expect(page.getByRole("form", { name: "Add task" })).toHaveCount(0);

      await page.getByRole("button", { name: "Try again" }).click();
      await expect(page.getByRole("heading", { name: `${marker} FailLoad`, level: 1 })).toBeVisible();
      await expect(page.getByRole("row", { name: new RegExp(`${marker} Focus`) })).toBeVisible();
      await expect(page.getByRole("form", { name: "Add task" })).toBeVisible();

      const deleteButton = page.getByRole("button", { name: `Delete ${marker} Focus` });
      await deleteButton.focus();
      await expect(deleteButton).toBeFocused();
      await deleteButton.click();

      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();
      await expect(dialog.getByRole("button", { name: "Cancel" })).toBeFocused();

      await page.keyboard.press("Shift+Tab");
      await expect(dialog.getByRole("button", { name: /^Delete$/ })).toBeFocused();
      await page.keyboard.press("Tab");
      await expect(dialog.getByRole("button", { name: "Cancel" })).toBeFocused();

      await dialog.getByRole("button", { name: "Cancel" }).click();
      await expect(dialog).toHaveCount(0);
      await expect(deleteButton).toBeFocused();
    } finally {
      await clearApiMock();
      await deleteTaskViaApi(request, e2e.apiURL, focusTask.id);
      await deleteCaseViaApi(request, e2e.apiURL, emptyCase.id);
      await deleteCaseViaApi(request, e2e.apiURL, delayedCase.id);
      await deleteCaseViaApi(request, e2e.apiURL, failCase.id);
      await deleteCustomerViaApi(request, e2e.apiURL, customer.id);
    }
  });

  test("failed create/edit/delete keep state and delayed actions block duplicates", async ({
    page,
    request,
    e2e,
  }) => {
    const marker = uniqueMarker("taskfail");
    const customer = await createCustomerViaApi(request, e2e.apiURL, {
      name: `${marker} Owner`,
      email: `${marker}@example.com`,
    });
    const work = await createCaseViaApi(request, e2e.apiURL, {
      customerId: customer.id,
      title: `${marker} Case`,
    });
    const existing = await createTaskViaApi(request, e2e.apiURL, {
      caseId: work.id,
      title: `${marker} Existing`,
      description: "keep me",
      dueDate: "2027-03-01",
    });
    const createdIds: number[] = [existing.id];

    try {
      await page.goto(`/cases/${work.id}`);
      await expect(page.getByRole("row", { name: new RegExp(`${marker} Existing`) })).toBeVisible();

      await setApiMock([
        {
          method: "POST",
          pathPrefix: "/api/tasks",
          status: 500,
          body: JSON.stringify({ title: "Mocked create failure" }),
          once: true,
        },
      ]);
      const addTask = page.getByRole("form", { name: "Add task" });
      await addTask.getByLabel("Title").fill(`${marker} New`);
      await addTask.getByLabel("Description").fill("Should stay");
      await addTask.getByLabel("Due date").fill("2026-11-20");
      await addTask.getByRole("button", { name: "Add task" }).click();
      await expect(addTask.getByRole("alert")).toBeVisible();
      await expect(addTask.getByLabel("Title")).toHaveValue(`${marker} New`);
      await expect(addTask.getByLabel("Description")).toHaveValue("Should stay");
      await expect(addTask.getByLabel("Due date")).toHaveValue("2026-11-20");

      await addTask.getByRole("button", { name: "Add task" }).click();
      await expect(page.getByRole("status").filter({ hasText: /was added/i })).toBeVisible();
      await expect(page.getByRole("row", { name: new RegExp(`${marker} New`) })).toBeVisible();

      const listed = await request.get(`${e2e.apiURL}/api/tasks?caseId=${work.id}`, {
        headers: bearerHeaders(e2e),
      });
      const tasks = (await listed.json()) as Array<{ id: number; title: string }>;
      const created = tasks.find((row) => row.title === `${marker} New`);
      expect(created).toBeTruthy();
      createdIds.push(created!.id);

      await setApiMock([
        {
          method: "PUT",
          pathPrefix: `/api/tasks/${existing.id}`,
          status: 500,
          body: JSON.stringify({ title: "Mocked update failure" }),
          once: true,
        },
      ]);
      await page.getByRole("button", { name: `Edit ${marker} Existing` }).click();
      const editForm = page.getByRole("form", { name: `Edit ${marker} Existing` });
      await editForm.getByLabel("Title").fill(`${marker} Existing Edited`);
      await editForm.getByLabel("Description").fill("Edited desc");
      await editForm.getByLabel("Due date").fill("2027-04-02");
      await selectTaskStatus(editForm.getByLabel("Status"), "InProgress");
      await editForm.getByRole("button", { name: "Save changes" }).click();
      await expect(editForm.getByRole("alert")).toBeVisible();
      await expect(editForm.getByLabel("Title")).toHaveValue(`${marker} Existing Edited`);
      await expect(editForm.getByLabel("Description")).toHaveValue("Edited desc");
      await expect(editForm.getByLabel("Due date")).toHaveValue("2027-04-02");
      await expect(editForm.getByLabel("Status")).toHaveValue("InProgress");

      await editForm.getByRole("button", { name: "Save changes" }).click();
      await expect(page.getByRole("status").filter({ hasText: /was updated/i })).toBeVisible();
      await expect(
        page.getByRole("row", { name: new RegExp(`${marker} Existing Edited`) }),
      ).toBeVisible();

      await setApiMock([
        {
          method: "DELETE",
          pathPrefix: `/api/tasks/${existing.id}`,
          status: 500,
          body: JSON.stringify({ title: "Mocked delete failure" }),
          once: true,
        },
      ]);
      await page.getByRole("button", { name: `Delete ${marker} Existing Edited` }).click();
      const dialog = page.getByRole("dialog");
      await dialog.getByRole("button", { name: /^Delete$/ }).click();
      await expect(dialog.getByRole("alert")).toBeVisible();
      await expect(dialog).toBeVisible();
      await expect(
        page.getByRole("row", { name: new RegExp(`${marker} Existing Edited`) }),
      ).toBeVisible();

      await dialog.getByRole("button", { name: /^Delete$/ }).click();
      await expect(page.getByRole("status")).toContainText(
        `${marker} Existing Edited was deleted.`,
      );
      await expect(
        page.getByRole("row", { name: new RegExp(`${marker} Existing Edited`) }),
      ).toHaveCount(0);
      createdIds.splice(
        createdIds.findIndex((id) => id === existing.id),
        1,
      );

      await setApiMock([
        {
          method: "POST",
          pathPrefix: "/api/tasks",
          delayMs: 3000,
          once: true,
        },
      ]);
      await addTask.getByLabel("Title").fill(`${marker} Slow`);
      await addTask.getByLabel("Description").fill("dup check");
      await addTask.getByRole("button", { name: "Add task" }).click();
      await expect(addTask.getByRole("button", { name: "Adding…" })).toBeDisabled();
      await expect(page.getByRole("status").filter({ hasText: /was added/i })).toBeVisible({
        timeout: 15_000,
      });

      const afterSlow = await request.get(`${e2e.apiURL}/api/tasks?caseId=${work.id}`, {
        headers: bearerHeaders(e2e),
      });
      const afterTasks = (await afterSlow.json()) as Array<{ id: number; title: string }>;
      const slowMatches = afterTasks.filter((row) => row.title === `${marker} Slow`);
      expect(slowMatches).toHaveLength(1);
      createdIds.push(slowMatches[0]!.id);

      await setApiMock([
        {
          method: "DELETE",
          pathPrefix: `/api/tasks/${slowMatches[0]!.id}`,
          delayMs: 3000,
          once: true,
        },
      ]);
      await page.getByRole("button", { name: `Delete ${marker} Slow` }).click();
      const slowDialog = page.getByRole("dialog");
      await slowDialog.getByRole("button", { name: /^Delete$/ }).click();
      await expect(slowDialog.getByRole("button", { name: "Deleting…" })).toBeDisabled();
      await expect(slowDialog.getByRole("button", { name: "Cancel" })).toBeDisabled();
      await expect(page.getByRole("status")).toContainText(`${marker} Slow was deleted.`, {
        timeout: 15_000,
      });
      createdIds.splice(
        createdIds.findIndex((id) => id === slowMatches[0]!.id),
        1,
      );

      await expect(page.getByRole("row", { name: new RegExp(`${marker} New`) })).toBeVisible();
      await expect(page.getByRole("heading", { name: `${marker} Case`, level: 1 })).toBeVisible();
    } finally {
      await clearApiMock();
      for (const id of createdIds) {
        await deleteTaskViaApi(request, e2e.apiURL, id);
      }
      await deleteCaseViaApi(request, e2e.apiURL, work.id);
      await deleteCustomerViaApi(request, e2e.apiURL, customer.id);
    }
  });
});
