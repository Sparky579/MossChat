import { headers } from "next/headers";

/**
 * Cloudflare and Vercel expose the visitor country as a request header. The
 * client uses this only for first-run guide language and never stores it.
 */
export async function GET() {
  const requestHeaders = await headers();
  const candidate = requestHeaders.get("cf-ipcountry")
    ?? requestHeaders.get("x-vercel-ip-country")
    ?? requestHeaders.get("x-country-code");
  const country = candidate?.trim().toUpperCase() ?? "";
  return Response.json(
    { country: /^[A-Z]{2}$/.test(country) ? country : null },
    { headers: { "Cache-Control": "no-store" } },
  );
}
