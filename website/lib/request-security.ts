const APPROVED_ORIGINS = new Set([
  "https://useformie.com",
  "https://www.useformie.com",
  "https://dashboard.useformie.app",
]);

function isApprovedOrigin(origin: string): boolean {
  if (APPROVED_ORIGINS.has(origin)) return true;
  if (process.env.NODE_ENV === "production") return false;
  try {
    const parsed = new URL(origin);
    return (parsed.protocol === "http:" || parsed.protocol === "https:")
      && ["127.0.0.1", "localhost", "[::1]"].includes(parsed.hostname);
  } catch {
    return false;
  }
}

function originMatchesRequestHost(request: Request, origin: string): boolean {
  try {
    const forwardedHost = request.headers.get("x-forwarded-host")?.split(",", 1)[0]?.trim();
    const requestHost = forwardedHost || request.headers.get("host")?.trim() || new URL(request.url).host;
    return new URL(origin).host.toLowerCase() === requestHost.toLowerCase();
  } catch {
    return false;
  }
}

export function publicRequestOrigin(request: Request): string {
  const origin = request.headers.get("origin");
  return origin && isApprovedOrigin(origin) && originMatchesRequestHost(request, origin)
    ? origin
    : new URL(request.url).origin;
}

function rejection(status: number, code: string): Response {
  return Response.json({ message: "Request rejected.", code }, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export function enforceSameOrigin(request: Request): Response | null {
  const origin = request.headers.get("Origin");
  if (!origin || !isApprovedOrigin(origin) || !originMatchesRequestHost(request, origin)) {
    return rejection(403, "REQUEST_REJECTED");
  }
  return null;
}

export async function readBoundedBody(request: Request, maxBytes: number): Promise<unknown> {
  const contentType = (request.headers.get("Content-Type") ?? "").split(";", 1)[0]!.trim().toLowerCase();
  if (contentType !== "application/json") throw new Error("UNSUPPORTED_MEDIA_TYPE");
  const declared = Number(request.headers.get("Content-Length"));
  if (Number.isFinite(declared) && declared > maxBytes) throw new Error("PAYLOAD_TOO_LARGE");
  const bytes = new Uint8Array(await request.arrayBuffer());
  if (bytes.byteLength > maxBytes) throw new Error("PAYLOAD_TOO_LARGE");
  return JSON.parse(new TextDecoder().decode(bytes));
}

export async function readBoundedUrlEncodedForm(request: Request, maxBytes: number): Promise<URLSearchParams> {
  const contentType = (request.headers.get("Content-Type") ?? "").split(";", 1)[0]!.trim().toLowerCase();
  if (contentType !== "application/x-www-form-urlencoded") throw new Error("UNSUPPORTED_MEDIA_TYPE");
  const declared = Number(request.headers.get("Content-Length"));
  if (Number.isFinite(declared) && declared > maxBytes) throw new Error("PAYLOAD_TOO_LARGE");
  const bytes = new Uint8Array(await request.arrayBuffer());
  if (bytes.byteLength > maxBytes) throw new Error("PAYLOAD_TOO_LARGE");
  return new URLSearchParams(new TextDecoder().decode(bytes));
}
