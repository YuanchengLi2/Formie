const APPROVED_ORIGINS = new Set([
  "https://useformie.com",
  "https://www.useformie.com",
  "https://dashboard.useformie.app",
]);

function rejection(status: number, code: string): Response {
  return Response.json({ message: "Request rejected.", code }, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export function enforceSameOrigin(request: Request): Response | null {
  const origin = request.headers.get("Origin");
  const requestOrigin = new URL(request.url).origin;
  if (!origin || origin !== requestOrigin || !APPROVED_ORIGINS.has(origin)) {
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
