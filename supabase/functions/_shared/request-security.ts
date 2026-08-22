export const APPROVED_BROWSER_ORIGINS = new Set([
  "https://useformie.com",
  "https://www.useformie.com",
  "https://dashboard.useformie.app",
]);

export type RequestAuthentication = "user" | "service" | "webhook" | "none";

export type RequestSecurityPolicy = {
  methods: readonly string[];
  authentication: RequestAuthentication;
  maxBodyBytes?: number;
  contentTypes?: readonly string[];
  allowBrowserOrigin?: boolean;
};

const DEFAULT_CONTENT_TYPES = ["application/json"];

function jsonError(request: Request, status: number, code: string): Response {
  return new Response(JSON.stringify({ code }), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store", "X-Request-Id": requestIdentifier(request) },
  });
}

export function requestIdentifier(request: Request): string {
  const supplied = request.headers.get("x-request-id")?.trim() ?? "";
  return /^[A-Za-z0-9._:-]{8,128}$/.test(supplied) ? supplied : crypto.randomUUID();
}

export function withRequestIdentifier(request: Request, response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set("X-Request-Id", requestIdentifier(request));
  headers.set("Cache-Control", "no-store");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

export function allowedCorsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get("Origin");
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-request-id",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Max-Age": "600",
    Vary: "Origin",
  };
  if (origin && APPROVED_BROWSER_ORIGINS.has(origin)) headers["Access-Control-Allow-Origin"] = origin;
  return headers;
}

function hasBearerAuthorization(request: Request): boolean {
  return /^Bearer\s+\S+$/i.test(request.headers.get("Authorization") ?? "");
}

function hasServiceAuthentication(request: Request): boolean {
  return hasBearerAuthorization(request) || Boolean(request.headers.get("apikey"));
}

export async function validateRequestSecurity(request: Request, policy: RequestSecurityPolicy): Promise<Response | null> {
  const origin = request.headers.get("Origin");
  if (origin && !APPROVED_BROWSER_ORIGINS.has(origin)) return jsonError(request, 403, "ORIGIN_NOT_ALLOWED");
  if (origin && policy.allowBrowserOrigin === false) return jsonError(request, 403, "BROWSER_REQUEST_NOT_ALLOWED");
  if (!policy.methods.includes(request.method)) return jsonError(request, 405, "METHOD_NOT_ALLOWED");

  if (policy.authentication === "user" && !hasBearerAuthorization(request)) return jsonError(request, 401, "UNAUTHORIZED");
  if (policy.authentication === "service" && !hasServiceAuthentication(request)) return jsonError(request, 401, "UNAUTHORIZED");
  if (!origin && policy.authentication === "none") return jsonError(request, 401, "AUTHENTICATION_REQUIRED");

  if (!["GET", "HEAD", "OPTIONS"].includes(request.method)) {
    const contentType = (request.headers.get("Content-Type") ?? "").split(";", 1)[0]!.trim().toLowerCase();
    const allowedTypes = policy.contentTypes ?? DEFAULT_CONTENT_TYPES;
    if (!allowedTypes.includes(contentType)) return jsonError(request, 415, "UNSUPPORTED_MEDIA_TYPE");
    const declaredLength = Number(request.headers.get("Content-Length"));
    if (policy.maxBodyBytes && Number.isFinite(declaredLength) && declaredLength > policy.maxBodyBytes) return jsonError(request, 413, "PAYLOAD_TOO_LARGE");
    if (policy.maxBodyBytes) {
      const bytes = new Uint8Array(await request.clone().arrayBuffer()).byteLength;
      if (bytes > policy.maxBodyBytes) return jsonError(request, 413, "PAYLOAD_TOO_LARGE");
    }
  }
  return null;
}

export function constantTimeEqual(left: string, right: string): boolean {
  const encoder = new TextEncoder();
  const leftBytes = encoder.encode(left);
  const rightBytes = encoder.encode(right);
  const length = Math.max(leftBytes.length, rightBytes.length);
  let difference = leftBytes.length ^ rightBytes.length;
  for (let index = 0; index < length; index += 1) {
    difference |= (leftBytes[index] ?? 0) ^ (rightBytes[index] ?? 0);
  }
  return difference === 0;
}
