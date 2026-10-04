import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { callJev, trimState, activeProvider } from "../lib/jev.js";
import { JevError } from "../lib/errors.js";
import { toVerdict } from "../lib/verdict.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// Minimal .env loader (stdlib only): fills env vars missing from the real environment.
try {
  const envText = await readFile(join(root, ".env"), "utf8");
  for (const line of envText.split("\n")) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!m || process.env[m[1]] !== undefined) continue;
    const q = m[2];
    process.env[m[1]] =
      q.length >= 2 && ((q.startsWith('"') && q.endsWith('"')) || (q.startsWith("'") && q.endsWith("'")))
        ? q.slice(1, -1)
        : q;
  }
} catch {
  /* no .env file — use the real environment */
}

const port = Number(process.env.PORT ?? 3000);

function send(res: import("node:http").ServerResponse, status: number, body: string, type: string): void {
  res.writeHead(status, { "Content-Type": type });
  res.end(body);
}

const server = createServer(async (req, res) => {
  if (req.method === "GET" && (req.url === "/" || req.url === "/index.html")) {
    send(res, 200, await readFile(join(root, "public/index.html"), "utf8"), "text/html; charset=utf-8");
    return;
  }
  if (req.method === "GET" && req.url === "/api/config") {
    send(
      res,
      200,
      JSON.stringify({ provider: activeProvider(), ollamaModel: process.env.OLLAMA_MODEL ?? "tev1:latest" }),
      "application/json",
    );
    return;
  }
  if (req.method === "POST" && req.url === "/api/check") {
    let raw = "";
    for await (const chunk of req) {
      raw += chunk;
      if (raw.length > 100_000) break;
    }
    let text = "";
    let threshold = 0.7;
    let provider: string | undefined;
    let apiKey = "";
    let model: string | undefined;
    try {
      const parsed = JSON.parse(raw || "{}") as {
        text?: unknown;
        threshold?: unknown;
        provider?: unknown;
        apiKey?: unknown;
        model?: unknown;
      };
      if (typeof parsed.text === "string") text = parsed.text;
      if (typeof parsed.threshold === "number" && parsed.threshold > 0 && parsed.threshold < 1) {
        threshold = parsed.threshold;
      }
      if (typeof parsed.provider === "string") provider = parsed.provider;
      if (typeof parsed.apiKey === "string") apiKey = parsed.apiKey.trim().slice(0, 200);
      if (typeof parsed.model === "string" && parsed.model.trim()) model = parsed.model.trim().slice(0, 100);
    } catch {
      send(res, 400, JSON.stringify({ error: "Invalid JSON body." }), "application/json");
      return;
    }
    if (!text.trim()) {
      send(res, 400, JSON.stringify({ error: "Paste some text first." }), "application/json");
      return;
    }
    const { state, trimmed } = trimState(text);
    try {
      const jev = await callJev(state, { apiKey, provider, model });
      const verdict = toVerdict(jev.answers, threshold);
      send(
        res,
        200,
        JSON.stringify({
          answers: jev.answers,
          usage: jev.usage ?? null,
          verdict,
          trimmed,
          threshold,
          provider: activeProvider(provider),
        }),
        "application/json",
      );
    } catch (err) {
      const status = err instanceof JevError ? err.status : 500;
      send(res, status, JSON.stringify({ error: err instanceof Error ? err.message : "Check failed." }), "application/json");
    }
    return;
  }
  send(res, 404, "Not found", "text/plain");
});

server.listen(port, () => {
  console.log(`slop detector on http://localhost:${port} (default provider: ${activeProvider()})`);
});
