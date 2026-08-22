/**
 * Keep the Cloudflare-managed public DNS while serving MossChat from Vercel.
 * The more-specific /feedback routes remain owned by mosschat-feedback.
 */
const VERCEL_ORIGIN = "https://ai-chat-sparky579s-projects.vercel.app";

export default {
  async fetch(request: Request): Promise<Response> {
    const source = new URL(request.url);
    const target = new URL(`${source.pathname}${source.search}`, VERCEL_ORIGIN);
    const headers = new Headers(request.headers);
    // Let Vercel receive its own hostname instead of the Cloudflare custom host.
    headers.delete("host");

    return fetch(target, {
      method: request.method,
      headers,
      redirect: "manual",
      ...(request.method === "GET" || request.method === "HEAD" ? {} : { body: request.body }),
    });
  },
};
