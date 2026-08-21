import { createServer } from "node:http";
import { mkdir, open, rename } from "node:fs/promises";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";

const port = Number.parseInt(process.env.FEEDBACK_PORT || "4190", 10);
const host = process.env.FEEDBACK_HOST || "127.0.0.1";
const dataDirectory = process.env.FEEDBACK_DATA_DIRECTORY
  || join(process.env.XDG_DATA_HOME || join(process.env.HOME || "/home/chengsizhe", ".local", "share"), "mosschat-feedback", "submissions");
const deliveryEndpoint = process.env.FEEDBACK_DELIVERY_ENDPOINT || "https://mosschat.xyz/feedback";
const allowedOrigins = new Set((process.env.FEEDBACK_ALLOWED_ORIGINS || "https://mosschat.xyz,https://www.mosschat.xyz")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean));
const maxRequestBytes = 32 * 1024;
const requestWindowMs = 10 * 60 * 1000;
const requestLimit = 12;
const requestBuckets = new Map();

function text(value, limit) {
  return typeof value === "string" ? value.trim().slice(0, limit) : "";
}

function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function sendJson(response, status, body, origin) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...(origin ? corsHeaders(origin) : {}),
  });
  response.end(JSON.stringify(body));
}

function clientAddress(request) {
  const forwarded = request.headers["cf-connecting-ip"] || request.headers["x-forwarded-for"];
  return typeof forwarded === "string" ? forwarded.split(",")[0].trim() : request.socket.remoteAddress || "unknown";
}

function isRateLimited(request) {
  const now = Date.now();
  const key = clientAddress(request);
  const active = (requestBuckets.get(key) || []).filter((time) => now - time < requestWindowMs);
  active.push(now);
  requestBuckets.set(key, active);
  if (requestBuckets.size > 1000) {
    for (const [address, times] of requestBuckets) if (!times.some((time) => now - time < requestWindowMs)) requestBuckets.delete(address);
  }
  return active.length > requestLimit;
}

async function readJsonBody(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > maxRequestBytes) throw new Error("too-large");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

async function writeRecord(path, record) {
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  const temporaryPath = `${path}.${randomUUID()}.tmp`;
  const file = await open(temporaryPath, "wx", 0o600);
  try {
    await file.writeFile(`${JSON.stringify(record, null, 2)}\n`, "utf8");
    await file.sync();
  } finally {
    await file.close();
  }
  await rename(temporaryPath, path);
}

async function deliver(recordPath, record) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(deliveryEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", "User-Agent": "MossChat-Feedback-Relay/1.0" },
      body: JSON.stringify(record.feedback),
      signal: controller.signal,
    });
    record.delivery = {
      status: response.ok ? "delivered" : "failed",
      statusCode: response.status,
      checkedAt: new Date().toISOString(),
    };
  } catch (error) {
    record.delivery = {
      status: "failed",
      error: error instanceof Error ? error.message.slice(0, 500) : "Unknown delivery failure",
      checkedAt: new Date().toISOString(),
    };
  } finally {
    clearTimeout(timeout);
  }
  try {
    await writeRecord(recordPath, record);
  } catch {
    // The original record was persisted before this best-effort mail relay.
  }
}

const server = createServer(async (request, response) => {
  const requestUrl = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);
  if (request.method === "GET" && requestUrl.pathname === "/health") return sendJson(response, 200, { ok: true });
  if (requestUrl.pathname !== "/feedback") return sendJson(response, 404, { error: "Not found" });

  const origin = request.headers.origin;
  if (!origin || !allowedOrigins.has(origin)) return sendJson(response, 403, { error: "Forbidden" });
  if (request.method === "OPTIONS") {
    response.writeHead(204, corsHeaders(origin));
    return response.end();
  }
  if (request.method !== "POST") return sendJson(response, 405, { error: "Method not allowed" }, origin);
  if ((Number(request.headers["content-length"]) || 0) > maxRequestBytes) return sendJson(response, 413, { error: "Feedback is too large." }, origin);
  if (isRateLimited(request)) return sendJson(response, 429, { error: "Please wait before sending more feedback." }, origin);

  let payload;
  try {
    payload = await readJsonBody(request);
  } catch (error) {
    const tooLarge = error instanceof Error && error.message === "too-large";
    return sendJson(response, tooLarge ? 413 : 400, { error: tooLarge ? "Feedback is too large." : "Invalid JSON." }, origin);
  }

  const feedback = {
    message: text(payload?.message, 4000),
    email: text(payload?.email, 254),
    subscribe: payload?.subscribe === true,
    reaction: payload?.reaction === "helpful" || payload?.reaction === "not-helpful" ? payload.reaction : "",
    chatTitle: text(payload?.chatTitle, 160),
    messageId: text(payload?.messageId, 160),
    response: text(payload?.response, 8000),
  };
  if (!feedback.message) return sendJson(response, 400, { error: "Feedback is required." }, origin);
  if (feedback.email && !validEmail(feedback.email)) return sendJson(response, 400, { error: "Enter a valid email address." }, origin);
  if (feedback.subscribe && !feedback.email) return sendJson(response, 400, { error: "An email is required for updates." }, origin);

  const receivedAt = new Date().toISOString();
  const id = randomUUID();
  const record = {
    schema: 1,
    id,
    receivedAt,
    origin,
    feedback,
    delivery: { status: "pending", endpoint: deliveryEndpoint },
  };
  const recordPath = join(dataDirectory, receivedAt.slice(0, 10), `${receivedAt.replace(/[:.]/g, "-")}_${id}.json`);
  try {
    await writeRecord(recordPath, record);
  } catch {
    return sendJson(response, 503, { error: "Feedback storage is temporarily unavailable." }, origin);
  }

  // Storage has succeeded, so mail failure can never discard the feedback or
  // make the browser retry and create a duplicate.
  void deliver(recordPath, record);
  return sendJson(response, 202, { ok: true, id }, origin);
});

server.requestTimeout = 15_000;
server.headersTimeout = 16_000;
server.listen(port, host, () => console.log(`MossChat feedback receiver listening on ${host}:${port}`));
