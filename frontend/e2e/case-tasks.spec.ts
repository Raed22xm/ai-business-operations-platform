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

test.describe("case details tasks", () => {
  test("create, edit statuses, cancel, delete, and preserve unrelated tasks", async ({
    page,
    request,
    e2e,
  }) => {
    const marker = uniqueMarker("casetask");
    const customer = await createCustomerViaApi(request, e2e.apiURL, {
      name: `${marker} Owner`,
      email: `${marker}@example.com`,
    });
    const work = await createCaseViaApi(request, e2e.apiURL, {
      customerId: customer.id,
      title: `${marker} Case`,
      description: "Case for task browser checks",
    });
    const keeper = await createTaskViaApi(request, e2e.apiURL, {
      caseId: work.id,
      title: `${marker} Keeper`,
      description: "Must remain after other task CRUD",
      dueDate: "2030-01-05",
    });

    const createdTaskIds: number[] = [keeper.id];

    try {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(`/cases/${work.id}`);

      await expect(page.getByRole("heading", { name: `${marker} Case`, level: 1 })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Tasks", level: 2 })).toBeVisible();
      await expect(page.getByRole("row", { name: new RegExp(`${marker} Keeper`) })).toContainText(
        "To do",
      );
      await expect(page.getByRole("row", { name: new RegExp(`${marker} Keeper`) })).toContainText(
        "Normal",
      );
      await expect(page.getByRole("row", { name: new RegExp(`${marker} Keeper`) })).toContainText(
        "05/01/2030",
      );

      const addTask = page.getByRole("form", { name: "Add task" });
      await addTask.getByLabel("Title").fill(`${marker} Draft`);
      await addTask.getByLabel("Description").fill("First pass");
      await addTask.getByLabel("Due date").fill("2026-10-15");
      await addTask.getByLabel("Priority").selectOption("High");
      await addTask.getByRole("button", { name: "Add task" }).click();

      await expect(page.getByRole("status").filter({ hasText: /was added/i })).toBeVisible();
      await expect(
        page.getByRole("row", { name: new RegExp(`${marker} Draft`) }).getByRole("cell").nth(1),
      ).toHaveText("To do");
      await expect(
        page.getByRole("row", { name: new RegExp(`${marker} Draft`) }).getByRole("cell").nth(2),
      ).toHaveText("High");
      await expect(
        page.getByRole("row", { name: new RegExp(`${marker} Draft`) }).getByRole("cell").nth(3),
      ).toHaveText("15/10/2026");

      const listed = await request.get(`${e2e.apiURL}/api/tasks?caseId=${work.id}`, {
        headers: bearerHeaders(e2e),
      });
      expect(listed.ok()).toBeTruthy();
      const tasks = (await listed.json()) as Array<{ id: number; title: string }>;
      const draft = tasks.find((row) => row.title === `${marker} Draft`);
      expect(draft).toBeTruthy();
      createdTaskIds.push(draft!.id);

      await page.getByRole("button", { name: `Edit ${marker} Draft` }).click();
      const editForm = page.getByRole("form", { name: `Edit ${marker} Draft` });
      await editForm.getByLabel("Title").fill(`${marker} Active`);
      await editForm.getByLabel("Description").fill("");
      await editForm.getByLabel("Due date").fill("");
      await editForm.getByLabel("Status").selectOption("InProgress");
      await editForm.getByRole("button", { name: "Cancel" }).click();

      await expect(page.getByRole("row", { name: new RegExp(`${marker} Draft`) })).toBeVisible();
      await expect(page.getByRole("form", { name: `Edit ${marker} Draft` })).toHaveCount(0);

      await page.getByRole("button", { name: `Edit ${marker} Draft` }).click();
      const editAgain = page.getByRole("form", { name: `Edit ${marker} Draft` });
      await editAgain.getByLabel("Title").fill(`${marker} Active`);
      await editAgain.getByLabel("Description").fill("");
      await editAgain.getByLabel("Due date").fill("");
      await editAgain.getByLabel("Status").selectOption("InProgress");
      await editAgain.getByRole("button", { name: "Save changes" }).click();

      await expect(page.getByRole("status").filter({ hasText: /was updated/i })).toBeVisible();
      await expect(page.getByRole("form", { name: `Edit ${marker} Draft` })).toHaveCount(0);
      await expect(
        page.getByRole("row", { name: new RegExp(`${marker} Active`) }).getByRole("cell").nth(1),
      ).toHaveText("In progress");
      await expect(
        page.getByRole("row", { name: new RegExp(`${marker} Active`) }).getByRole("cell").nth(2),
      ).toHaveText("High");
      await expect(
        page.getByRole("row", { name: new RegExp(`${marker} Active`) }).getByRole("cell").nth(3),
      ).toHaveText("—");

      await page.getByRole("button", { name: `Edit ${marker} Active` }).click();
      const editDone = page.getByRole("form", { name: `Edit ${marker} Active` });
      await editDone.getByLabel("Status").selectOption("Done");
      await editDone.getByLabel("Priority").selectOption("Low");
      await editDone.getByRole("button", { name: "Save changes" }).click();
      await expect(page.getByRole("status").filter({ hasText: /was updated/i })).toBeVisible();
      await expect(page.getByRole("form", { name: `Edit ${marker} Active` })).toHaveCount(0);
      const activeRow = page.getByRole("row", { name: new RegExp(`${marker} Active`) });
      await expect(activeRow.getByRole("cell").nth(1)).toHaveText("Done");
      await expect(activeRow.getByRole("cell").nth(2)).toHaveText("Low");

      await page.reload();
      await expect(page.getByRole("heading", { name: `${marker} Case`, level: 1 })).toBeVisible();
      await expect(
        page.getByRole("row", { name: new RegExp(`${marker} Active`) }).getByRole("cell").nth(1),
      ).toHaveText("Done");
      await expect(
        page.getByRole("row", { name: new RegExp(`${marker} Keeper`) }).getByRole("cell").nth(3),
      ).toHaveText("05/01/2030");

      await page.getByRole("button", { name: `Delete ${marker} Active` }).click();
      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();
      await expect(dialog).toContainText(`${marker} Active`);
      await dialog.getByRole("button", { name: "Cancel" }).click();
      await expect(dialog).toHaveCount(0);
      await expect(page.getByRole("row", { name: new RegExp(`${marker} Active`) })).toBeVisible();

      await page.getByRole("button", { name: `Delete ${marker} Active` }).click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await expect(page.getByRole("row", { name: new RegExp(`${marker} Active`) })).toBeVisible();

      await page.getByRole("button", { name: `Delete ${marker} Active` }).click();
      await confirmDeleteDialog(page);
      await expect(page.getByRole("status")).toContainText(`${marker} Active was deleted.`);
      await expect(page.getByRole("row", { name: new RegExp(`${marker} Active`) })).toHaveCount(0);
      await expect(page.getByRole("row", { name: new RegExp(`${marker} Keeper`) })).toBeVisible();
      await expect(page.getByRole("heading", { name: `${marker} Case`, level: 1 })).toBeVisible();

      createdTaskIds.splice(
        createdTaskIds.findIndex((id) => id === draft!.id),
        1,
      );

      const addInvalid = page.getByRole("form", { name: "Add task" });
      await addInvalid.getByLabel("Title").fill("   ");
      await addInvalid.getByRole("button", { name: "Add task" }).click();
      await expect(addInvalid.getByRole("alert")).toBeVisible();
      await expect(addInvalid.getByLabel("Title")).toHaveValue("   ");
    } finally {
      for (const id of createdTaskIds) {
        await deleteTaskViaApi(request, e2e.apiURL, id);
      }
      await deleteCaseViaApi(request, e2e.apiURL, work.id);
      await deleteCustomerViaApi(request, e2e.apiURL, customer.id);
    }
  });
});
