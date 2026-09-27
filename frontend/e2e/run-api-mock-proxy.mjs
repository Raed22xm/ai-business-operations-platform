import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const mockRulesPath = path.join(__dirname, ".runtime", "api-mock-rules.json");
const listenPort = Number(process.env.E2E_PROXY_PORT ?? "5230");
const upstreamOrigin = process.env.E2E_UPSTREAM_API_URL ?? "http://127.0.0.1:5231";

function readRules() {
  try {
    if (!fs.existsSync(mockRulesPath)) {
      return [];
    }
    const parsed = JSON.parse(fs.readFileSync(mockRulesPath, "utf8"));
    return Array.isArray(parsed.rules) ? parsed.rules : [];
  } catch {
    return [];
  }
}

function writeRules(rules) {
  fs.mkdirSync(path.dirname(mockRulesPath), { recursive: true });
  fs.writeFileSync(mockRulesPath, JSON.stringify({ rules }, null, 2));
}

function takeMatchingRule(method, pathname) {
  const rules = readRules();
  const index = rules.findIndex(
    (rule) =>
      String(rule.method).toUpperCase() === method.toUpperCase() &&
      pathname.startsWith(rule.pathPrefix),
  );
  if (index < 0) {
    return null;
  }
  const rule = rules[index];
  if (rule.once) {
    writeRules([...rules.slice(0, index), ...rules.slice(index + 1)]);
  }
  return rule;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function forward(req, res) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const body = Buffer.concat(chunks);
  const target = new URL(req.url ?? "/", upstreamOrigin);
  const headers = {};
  for (const [key, value] of Object.entries(req.headers)) {
    if (value === undefined || key.toLowerCase() === "host") {
      continue;
    }
    headers[key] = Array.isArray(value) ? value.join(", ") : value;
  }

  const upstream = await fetch(target, {
    method: req.method,
    headers,
    body: req.method === "GET" || req.method === "HEAD" ? undefined : body,
    redirect: "manual",
  });

  res.statusCode = upstream.status;
  upstream.headers.forEach((value, key) => {
    if (key.toLowerCase() === "transfer-encoding") {
      return;
    }
    res.setHeader(key, value);
  });
  res.end(Buffer.from(await upstream.arrayBuffer()));
}

writeRules([]);

const server = http.createServer((req, res) => {
  void (async () => {
    try {
      const method = req.method ?? "GET";
      const pathname = new URL(req.url ?? "/", "http://127.0.0.1").pathname;
      const rule = takeMatchingRule(method, pathname);

      if (rule?.delayMs > 0) {
        await delay(rule.delayMs);
      }

      if (rule?.drop) {
        req.socket.destroy();
        return;
      }

      if (rule?.status) {
        res.statusCode = rule.status;
        res.setHeader("Content-Type", rule.contentType ?? "application/json");
        res.end(rule.body ?? JSON.stringify({ title: "Mocked failure" }));
        return;
      }

      await forward(req, res);
    } catch (error) {
      if (!res.headersSent) {
        res.statusCode = 502;
        res.setHeader("Content-Type", "application/json");
        res.end(
          JSON.stringify({
            title: "Proxy error",
            detail: error instanceof Error ? error.message : String(error),
          }),
        );
      } else {
        req.socket.destroy();
      }
    }
  })();
});

server.listen(listenPort, "127.0.0.1", () => {
  process.stdout.write(`api-mock-proxy listening on ${listenPort} -> ${upstreamOrigin}\n`);
});

const shutdown = () => {
  server.close(() => process.exit(0));
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
