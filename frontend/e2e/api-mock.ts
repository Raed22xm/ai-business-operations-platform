import fs from "node:fs";
import path from "node:path";
import { mockRulesPath } from "./env";

export type ApiMockRule = {
  method: string;
  /** Match when request path starts with this prefix (query string ignored). */
  pathPrefix: string;
  delayMs?: number;
  /** When set, respond with this status instead of forwarding. */
  status?: number;
  body?: string;
  contentType?: string;
  /** Drop the connection so fetch throws (network failure). */
  drop?: boolean;
  /** Remove the rule after one match. */
  once?: boolean;
};

export async function setApiMock(rules: ApiMockRule[]): Promise<void> {
  fs.mkdirSync(path.dirname(mockRulesPath), { recursive: true });
  fs.writeFileSync(mockRulesPath, JSON.stringify({ rules }, null, 2));
  await new Promise((resolve) => setTimeout(resolve, 20));
}

export async function clearApiMock(): Promise<void> {
  await setApiMock([]);
}
