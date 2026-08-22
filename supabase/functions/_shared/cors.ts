import { allowedCorsHeaders, validateRequestSecurity, withRequestIdentifier, type RequestSecurityPolicy } from "./request-security.ts";

export function corsHeadersFor(request: Request): Record<string, string> {
  return allowedCorsHeaders(request);
}

export function withCors(request: Request, response: Response): Response {
  const identified = withRequestIdentifier(request, response);
  const headers = new Headers(identified.headers);
  for (const [key, value] of Object.entries(corsHeadersFor(request))) headers.set(key, value);
  return new Response(identified.body, { status: identified.status, statusText: identified.statusText, headers });
}

export function preflight(request: Request): Response | null {
  if (request.method !== "OPTIONS") return null;
  const headers = corsHeadersFor(request);
  if (!headers["Access-Control-Allow-Origin"]) {
    return new Response(JSON.stringify({ code: "ORIGIN_NOT_ALLOWED" }), {
      status: 403,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store", Vary: "Origin" },
    });
  }
  return new Response(null, { status: 204, headers });
}

export async function secureBrowserRequest(request: Request, policy: RequestSecurityPolicy): Promise<Response | null> {
  const options = preflight(request);
  if (options) return options;
  const failure = await validateRequestSecurity(request, policy);
  return failure ? withCors(request, failure) : null;
}
