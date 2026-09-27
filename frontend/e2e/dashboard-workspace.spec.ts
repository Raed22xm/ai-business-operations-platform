import path from "node:path";
import { test, expect, createCustomerViaApi, createCaseViaApi, createTaskViaApi, deleteCaseViaApi, deleteCustomerViaApi, deleteTaskViaApi, bearerHeaders } from "./helpers";

test("dashboard selection, search, real tasks, responsive layout and navigation", async ({ page, request, e2e }) => {
  const customers: number[] = [], cases: number[] = [], tasks: number[] = [];
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  try {
    const names = ["Sarah Chen", "Michael Brown", "Jessica Williams", "Daniel Jensen", "Sofia Larsen", "Oliver Hansen", "Emma Nielsen", "James Wilson"];
    for (let i = 0; i < names.length; i++) {
      const customer = await createCustomerViaApi(request, e2e.apiURL, { name: names[i], email: `${names[i].toLowerCase().replaceAll(" ", ".")}@example.com`, company: ["EcoTech Solutions", "Apex Dynamics", "Innovate Studio", "North Design"][i % 4] });
      customers.push(customer.id);
    }
    const selected = await createCaseViaApi(request, e2e.apiURL, { customerId: customers[0], title: "Weekend service booking & consultation", description: "Confirm the booking details and preferred time for the weekend consultation." });
    cases.push(selected.id);
    await request.put(`${e2e.apiURL}/api/cases/${selected.id}`, {
      headers: bearerHeaders(e2e),
      data: {
        title: selected.title,
        description: "Confirm the booking details and preferred time for the weekend consultation.",
        status: "InProgress",
      },
    });
    const second = await createCaseViaApi(request, e2e.apiURL, { customerId: customers[0], title: "Brand refresh" });
    cases.push(second.id);
    for (const title of ["Confirm client details", "Schedule initial consultation"]) {
      const task = await createTaskViaApi(request, e2e.apiURL, { caseId: selected.id, title }); tasks.push(task.id);
    }
    await page.setViewportSize({ width: 1440, height: 960 });
    await page.goto(`${e2e.baseURL}/?customerId=${customers[0]}&caseId=${selected.id}`);
    const dashboard = page.getByRole("main", { name: "Operations dashboard" });
    await expect(dashboard.getByRole("heading", { name: "Customer list", exact: true })).toBeVisible();
    await expect(dashboard.getByRole("heading", { name: selected.title, exact: true })).toBeVisible();
    await expect(dashboard.getByLabel("Case creation and current tasks").getByText("Confirm client details", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Draft response", exact: true })).toBeEnabled();
    await expect(page.getByRole("button", { name: "Generate summary", exact: true })).toBeEnabled();
    await expect(page.getByRole("button", { name: /Schedule follow-up/i })).toBeEnabled();
    await expect(page.getByRole("button", { name: /Escalation check/i })).toBeDisabled();
    await expect(page.getByText("Coming soon").first()).toBeVisible();
    await expect(page.getByText("Generate a summary or draft from this case’s saved data")).toBeVisible();
    await expect(dashboard.getByRole("link", { name: "Select Sarah Chen" })).toHaveAttribute("aria-current", "true");
    await page.screenshot({ path: path.join(__dirname, "../../docs/screenshots/dashboard-reference-desktop.png"), fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
    await page.getByLabel("Choose a case").selectOption(String(second.id));
    await expect(dashboard.getByRole("heading", { name: "Brand refresh", exact: true })).toBeVisible();
    await page.getByRole("link", { name: "Select Michael Brown" }).click();
    await expect(dashboard.getByRole("heading", { name: "A fresh start", exact: true })).toBeVisible();
    await page.getByRole("searchbox", { name: "Search customers" }).fill("Jessica");
    await page.getByRole("button", { name: "Submit customer search" }).click();
    await expect(page.getByRole("link", { name: "Select Jessica Williams" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Select Sarah Chen" })).toHaveCount(0);
    await page.goto(`${e2e.baseURL}/?customerId=${customers[0]}&caseId=${selected.id}`);
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(dashboard.getByRole("heading", { name: selected.title, exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
    await page.screenshot({ path: path.join(__dirname, "../../docs/screenshots/dashboard-reference-mobile.png"), fullPage: true });
    await page.getByRole("button", { name: "Open navigation" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).not.toBeVisible();
    await expect(page.getByRole("button", { name: "Open navigation" })).toBeFocused();
    // Capture the connected workspaces with the same disposable records.
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 960 });
      for (const route of [
        { name: "customers", url: "/customers" },
        { name: "cases", url: "/cases" },
        { name: "customer-details", url: `/customers/${customers[0]}` },
        { name: "case-tasks", url: `/cases/${selected.id}` },
      ]) {
        await page.goto(`${e2e.baseURL}${route.url}`);
        await expect(page.locator(".crm-table-scroll").first()).toBeVisible();
        await page.screenshot({ path: path.join(__dirname, `../../docs/screenshots/${route.name}-${width}.png`), fullPage: true });
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `${route.name} at ${width}px`).toBeTruthy();
      }
    }
    expect(errors).toEqual([]);
  } finally {
    for (const id of tasks) await deleteTaskViaApi(request, e2e.apiURL, id);
    for (const id of cases) await deleteCaseViaApi(request, e2e.apiURL, id);
    for (const id of customers) await deleteCustomerViaApi(request, e2e.apiURL, id);
  }
});

test("dashboard empty search uses real empty states", async ({ page, e2e }) => {
  await page.goto(`${e2e.baseURL}/?q=no-such-customer-dashboard-check`);
  await expect(page.getByRole("heading", { name: "No matching customers" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Your next case, in focus" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Copy brief" })).toBeDisabled();
  await page.getByRole("link", { name: "Clear search" }).click();
  await expect(page).toHaveURL(`${e2e.baseURL}/`);
});
