import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import {
  assertNotDevelopmentDatabase,
  apiProject,
  backendRoot,
  E2E_API_PORT,
  E2E_CONTAINER_NAME,
  E2E_DATABASE,
  E2E_DB_PASSWORD,
  E2E_DB_USER,
  E2E_FRONTEND_PORT,
  frontendRoot,
  runtimeDir,
  statePath,
  type E2EState,
} from "./env";

const DOTNET = path.join(process.env.HOME ?? "", ".dotnet", "dotnet");
const PATH_WITH_DOTNET = `${path.join(process.env.HOME ?? "", ".dotnet")}:${process.env.PATH ?? ""}`;

export default async function globalSetup(): Promise<void> {
  fs.mkdirSync(runtimeDir, { recursive: true });

  if (!fs.existsSync(DOTNET)) {
    writeSkip(`Browser e2e not run: .NET SDK not found at ${DOTNET}.`);
    return;
  }

  try {
    await run("docker", ["info"], { timeoutMs: 15_000 });
  } catch (error) {
    writeSkip(
      `Browser e2e not run: Docker is unavailable (${error instanceof Error ? error.message : String(error)}).`,
    );
    return;
  }

  try {
    await removeContainerIfExists(E2E_CONTAINER_NAME);

    await run("docker", [
      "run",
      "-d",
      "--name",
      E2E_CONTAINER_NAME,
      "-e",
      `POSTGRES_DB=${E2E_DATABASE}`,
      "-e",
      `POSTGRES_USER=${E2E_DB_USER}`,
      "-e",
      `POSTGRES_PASSWORD=${E2E_DB_PASSWORD}`,
      "-p",
      "127.0.0.1::5432",
      "postgres:16-alpine",
    ]);

    const hostPort = await waitForPublishedPort(E2E_CONTAINER_NAME);
    const connectionString =
      `Host=127.0.0.1;Port=${hostPort};Database=${E2E_DATABASE};Username=${E2E_DB_USER};Password=${E2E_DB_PASSWORD}`;
    assertNotDevelopmentDatabase(connectionString);

    await waitForPostgres();

    const efEnv = {
      ...process.env,
      PATH: PATH_WITH_DOTNET,
      DOTNET_ROOT: path.dirname(DOTNET),
      ConnectionStrings__DefaultConnection: connectionString,
    };

    await run(DOTNET, ["tool", "restore"], {
      cwd: backendRoot,
      env: efEnv,
    });
    await run(
      DOTNET,
      [
        "tool",
        "run",
        "dotnet-ef",
        "database",
        "update",
        "--project",
        apiProject,
        "--connection",
        connectionString,
      ],
      {
        cwd: backendRoot,
        env: efEnv,
        timeoutMs: 120_000,
      },
    );

    await run(
      DOTNET,
      ["build", apiProject, "-v", "q"],
      {
        cwd: backendRoot,
        env: efEnv,
        timeoutMs: 180_000,
      },
    );

    const apiLog = path.join(runtimeDir, "api.log");
    const api = spawnDetached(
      DOTNET,
      ["run", "--project", apiProject, "--no-launch-profile", "--no-build"],
      {
        cwd: backendRoot,
        env: {
          ...process.env,
          PATH: PATH_WITH_DOTNET,
          DOTNET_ROOT: path.dirname(DOTNET),
          ASPNETCORE_ENVIRONMENT: "Development",
          ASPNETCORE_URLS: `http://127.0.0.1:${E2E_API_PORT}`,
          ConnectionStrings__DefaultConnection: connectionString,
        },
        logPath: apiLog,
      },
    );

    const apiURL = `http://127.0.0.1:${E2E_API_PORT}`;
    await waitForUrl(`${apiURL}/api/health`, 60_000);

    const frontendLog = path.join(runtimeDir, "frontend.log");
    await run(
      process.platform === "win32" ? "npm.cmd" : "npm",
      ["run", "build"],
      {
        cwd: frontendRoot,
        env: {
          ...process.env,
          API_BASE_URL: apiURL,
        },
        timeoutMs: 180_000,
      },
    );

    const frontend = spawnDetached(
      process.platform === "win32" ? "npx.cmd" : "npx",
      ["next", "start", "--port", String(E2E_FRONTEND_PORT), "--hostname", "localhost"],
      {
        cwd: frontendRoot,
        env: {
          ...process.env,
          API_BASE_URL: apiURL,
        },
        logPath: frontendLog,
      },
    );

    const baseURL = `http://localhost:${E2E_FRONTEND_PORT}`;
    await waitForUrl(baseURL, 90_000);

    const state: E2EState = {
      skipped: false,
      baseURL,
      apiURL,
      connectionString,
      containerName: E2E_CONTAINER_NAME,
      apiPid: api.pid ?? undefined,
      frontendPid: frontend.pid ?? undefined,
    };
    fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
  } catch (error) {
    writeSkip(
      `Browser e2e not run: setup failed (${error instanceof Error ? error.message : String(error)}).`,
    );
  }
}

function writeSkip(reason: string): void {
  const state: E2EState = {
    skipped: true,
    skipReason: reason,
    baseURL: `http://localhost:${E2E_FRONTEND_PORT}`,
    apiURL: `http://127.0.0.1:${E2E_API_PORT}`,
  };
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
  console.warn(reason);
}

async function removeContainerIfExists(name: string): Promise<void> {
  try {
    await run("docker", ["rm", "-f", name], { timeoutMs: 30_000 });
  } catch {
    // Container may not exist yet.
  }
}

async function waitForPublishedPort(containerName: string): Promise<string> {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const output = await run("docker", ["port", containerName, "5432"], {
      timeoutMs: 5_000,
    });
    const match = /127\.0\.0\.1:(\d+)/.exec(output);
    if (match) {
      return match[1];
    }
    await delay(250);
  }
  throw new Error(`Could not read published Postgres port for ${containerName}.`);
}

async function waitForPostgres(): Promise<void> {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      await run("docker", [
        "exec",
        E2E_CONTAINER_NAME,
        "pg_isready",
        "-U",
        E2E_DB_USER,
        "-d",
        E2E_DATABASE,
      ]);
      return;
    } catch {
      await delay(500);
    }
  }
  throw new Error("PostgreSQL did not become ready.");
}

async function waitForUrl(url: string, timeoutMs: number): Promise<void> {
  const started = Date.now();
  let lastError = "";
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok || response.status === 404) {
        return;
      }
      lastError = `HTTP ${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await delay(400);
  }
  throw new Error(`Timed out waiting for ${url}: ${lastError}`);
}

function spawnDetached(
  command: string,
  args: string[],
  options: { cwd: string; env: NodeJS.ProcessEnv; logPath: string },
): { pid?: number } {
  const log = fs.openSync(options.logPath, "w");
  const child = spawn(command, args, {
    cwd: options.cwd,
    env: options.env,
    detached: true,
    stdio: ["ignore", log, log],
  });
  child.unref();
  return child;
}

async function run(
  command: string,
  args: string[],
  options?: { cwd?: string; env?: NodeJS.ProcessEnv; timeoutMs?: number },
): Promise<string> {
  return await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options?.cwd,
      env: options?.env ?? process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error(`Timed out: ${command} ${args.join(" ")}`));
    }, options?.timeoutMs ?? 60_000);

    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) {
        resolve(stdout.trim());
        return;
      }
      reject(
        new Error(
          `${command} ${args.join(" ")} failed (${code}): ${stderr || stdout}`,
        ),
      );
    });
  });
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
