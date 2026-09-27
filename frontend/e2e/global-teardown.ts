import fs from "node:fs";
import { statePath, type E2EState, E2E_CONTAINER_NAME } from "./env";
import { spawn } from "node:child_process";

function readState(): E2EState | null {
  if (!fs.existsSync(statePath)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(statePath, "utf8")) as E2EState;
}

function killPid(pid: number | undefined): void {
  if (!pid) {
    return;
  }
  try {
    process.kill(-pid, "SIGTERM");
  } catch {
    try {
      process.kill(pid, "SIGTERM");
    } catch {
      // Already exited.
    }
  }
}

async function run(command: string, args: string[]): Promise<void> {
  await new Promise<void>((resolve) => {
    const child = spawn(command, args, { stdio: "ignore" });
    child.on("close", () => resolve());
    child.on("error", () => resolve());
  });
}

export default async function globalTeardown(): Promise<void> {
  const state = readState();
  if (!state || state.skipped) {
    return;
  }

  killPid(state.frontendPid);
  killPid(state.apiPid);

  const container = state.containerName ?? E2E_CONTAINER_NAME;
  await run("docker", ["rm", "-f", container]);
}
