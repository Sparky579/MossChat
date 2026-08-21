type Env = {
  RESEND_API_KEY: string;
  RESEND_FROM: string;
  RESEND_AUDIENCE_ID?: string;
  ALLOWED_ORIGIN?: string;
};

type FeedbackPayload = {
  message?: unknown;
  email?: unknown;
  subscribe?: unknown;
  reaction?: unknown;
  chatTitle?: unknown;
  messageId?: unknown;
  response?: unknown;
};

const feedbackMailbox = "shantayreynar@gmail.com";
const maxRequestBytes = 32 * 1024;

class RequestBodyTooLargeError extends Error {}

function headers(origin: string) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function json(body: Record<string, unknown>, status: number, origin: string) {
  return new Response(JSON.stringify(body), { status, headers: { ...headers(origin), "Content-Type": "application/json; charset=utf-8" } });
}

function text(value: unknown, limit: number) {
  return typeof value === "string" ? value.trim().slice(0, limit) : "";
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character] ?? character);
}

function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function field(label: string, value: string) {
  return `<p><strong>${escapeHtml(label)}:</strong><br>${escapeHtml(value || "Not provided").replace(/\n/g, "<br>")}</p>`;
}

/** Enforces the limit even when a client omits or lies about Content-Length. */
async function parseFeedbackPayload(request: Request): Promise<FeedbackPayload> {
  if (!request.body) throw new SyntaxError("Request body is required.");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxRequestBytes) {
      await reader.cancel();
      throw new RequestBodyTooLargeError();
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return JSON.parse(new TextDecoder().decode(bytes)) as FeedbackPayload;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const allowedOrigin = env.ALLOWED_ORIGIN || "https://chat.utilgadgets.com";
    const requestOrigin = request.headers.get("Origin");
    if (requestOrigin && requestOrigin !== allowedOrigin) return new Response("Forbidden", { status: 403 });
    const origin = requestOrigin || allowedOrigin;

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: headers(origin) });
    if (new URL(request.url).pathname !== "/feedback") return json({ error: "Not found" }, 404, origin);
    if (request.method !== "POST") return json({ error: "Method not allowed" }, 405, origin);
    if ((Number(request.headers.get("Content-Length")) || 0) > maxRequestBytes) return json({ error: "Feedback is too large." }, 413, origin);

    let payload: FeedbackPayload;
    try {
      payload = await parseFeedbackPayload(request);
    } catch (error) {
      if (error instanceof RequestBodyTooLargeError) return json({ error: "Feedback is too large." }, 413, origin);
      return json({ error: "Invalid JSON." }, 400, origin);
    }

    const message = text(payload.message, 4000);
    const email = text(payload.email, 254);
    const subscribe = payload.subscribe === true;
    const reaction = payload.reaction === "helpful" || payload.reaction === "not-helpful" ? payload.reaction : "";
    const chatTitle = text(payload.chatTitle, 160);
    const messageId = text(payload.messageId, 160);
    const answer = text(payload.response, 8000);
    if (!message) return json({ error: "Feedback is required." }, 400, origin);
    if (email && !validEmail(email)) return json({ error: "Enter a valid email address." }, 400, origin);
    if (subscribe && !email) return json({ error: "An email is required for updates." }, 400, origin);
    if (!env.RESEND_API_KEY || !env.RESEND_FROM) return json({ error: "Feedback delivery is not configured." }, 503, origin);

    const html = `<h2>MossChat feedback</h2>${field("Feedback", message)}${field("Email", email)}${field("Reaction", reaction)}${field("Subscribe to updates", subscribe ? "Yes" : "No")}${field("Chat", chatTitle)}${field("Message ID", messageId)}${answer ? field("Assistant response", answer) : ""}`;
    const sent = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: env.RESEND_FROM,
        to: [feedbackMailbox],
        reply_to: email || undefined,
        subject: `MossChat feedback${reaction ? `: ${reaction}` : ""}`,
        html,
      }),
    });
    if (!sent.ok) return json({ error: "Feedback delivery failed." }, 502, origin);

    if (subscribe && email && env.RESEND_AUDIENCE_ID) {
      await fetch(`https://api.resend.com/audiences/${encodeURIComponent(env.RESEND_AUDIENCE_ID)}/contacts`, {
        method: "POST",
        headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ email, unsubscribed: false }),
      });
    }

    return json({ ok: true }, 202, origin);
  },
};
