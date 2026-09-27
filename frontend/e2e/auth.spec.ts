import { test, expect } from "./helpers";
import { E2E_AUTH_PASSWORD, E2E_AUTH_USERNAME } from "./env";

test("unauthenticated visitors are sent to sign-in", async ({ page, e2e }) => {
  await page.goto(`${e2e.baseURL}/`);
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
});

test("invalid credentials show a clear error", async ({ page, e2e }) => {
  await page.goto(`${e2e.baseURL}/login`);
  await page.getByLabel("Username").fill(E2E_AUTH_USERNAME);
  await page.getByLabel("Password").fill("wrong-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.locator("#login-error")).toContainText("Invalid username or password");
  await expect(page).toHaveURL(/\/login/);
});

test("valid sign-in reaches the dashboard and sign-out returns to login", async ({ page, e2e }) => {
  await page.goto(`${e2e.baseURL}/login`);
  await page.getByLabel("Username").fill(E2E_AUTH_USERNAME);
  await page.getByLabel("Password").fill(E2E_AUTH_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(e2e.baseURL + "/");
  await expect(page.getByRole("main", { name: "Operations dashboard" })).toBeVisible();

  await page.getByText("My workspace").click();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login/);
  await page.goto(`${e2e.baseURL}/customers`);
  await expect(page).toHaveURL(/\/login/);
});
