import path from "node:path";

/** Ports chosen to avoid the development stack (API 5222, frontend 3000, Postgres 5434). */
/** Public API URL used by Next and Playwright (mock proxy). */
export const E2E_API_PORT = 5230;
/** Real ASP.NET listener behind the mock proxy. */
export const E2E_API_UPSTREAM_PORT = 5231;
export const E2E_FRONTEND_PORT = 3100;

export const FORBIDDEN_DATABASE = "aibusiness_customers_dev";
export const E2E_DATABASE = "aibusiness_browser_e2e";
export const E2E_CONTAINER_NAME = "aibusiness-browser-e2e-postgres";
export const E2E_DB_USER = "aibusiness_e2e";
export const E2E_DB_PASSWORD = "browser-e2e-only";

export const repoRoot = path.resolve(__dirname, "../..");
export const frontendRoot = path.resolve(__dirname, "..");
export const backendRoot = path.join(repoRoot, "backend");
export const apiProject = path.join(backendRoot, "src", "AiBusiness.Api");
export const runtimeDir = path.join(__dirname, ".runtime");
export const statePath = path.join(runtimeDir, "state.json");
export const mockRulesPath = path.join(runtimeDir, "api-mock-rules.json");

export type E2EState = {
  skipped: boolean;
  skipReason?: string;
  baseURL: string;
  apiURL: string;
  connectionString?: string;
  containerName?: string;
  apiPid?: number;
  proxyPid?: number;
  frontendPid?: number;
};

export function assertNotDevelopmentDatabase(connectionString: string): void {
  const match = /(?:^|;)Database=([^;]+)/i.exec(connectionString);
  const database = match?.[1]?.trim() ?? "";
  if (database.toLowerCase() === FORBIDDEN_DATABASE.toLowerCase()) {
    throw new Error(
      `Refusing to use the development database '${FORBIDDEN_DATABASE}'. Browser e2e tests must use a disposable database.`,
    );
  }
  if (database.length === 0) {
    throw new Error("Browser e2e tests require an explicit database name.");
  }
}
