import { parseSupportRequest } from "../../../lib/support-request";

function json(payload: unknown, status: number) {
  return Response.json(payload, { status });
}

function observedClientIp(request: Request): string {
  const forwarded = request.headers.get("x-vercel-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || "unknown";
}

export async function POST(request: Request): Promise<Response> {
  let body;
  try {
    body = parseSupportRequest(await request.json());
  } catch {
    return json({
      message: "Enter a valid email, choose a category, and write 20–2,000 characters.",
      code: "INVALID_SUPPORT_REQUEST",
    }, 400);
  }

  const functionUrl = process.env.FORMIE_SUPPORT_FUNCTION_URL;
  const internalToken = process.env.FORMIE_SUPPORT_INTERNAL_TOKEN;
  if (!functionUrl || !internalToken) {
    return json({ message: "Support is temporarily unavailable.", code: "SUPPORT_NOT_CONFIGURED" }, 503);
  }

  let upstream: Response;
  try {
    upstream = await fetch(functionUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${internalToken}`,
        "Content-Type": "application/json",
        "X-Formie-Client-IP": observedClientIp(request),
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });
  } catch {
    return json({ message: "Support is temporarily unavailable. Try again.", code: "SUPPORT_UNAVAILABLE" }, 502);
  }

  const payload = await upstream.json().catch(() => null);
  if (!upstream.ok) {
    const safeStatus = upstream.status === 429 ? 429 : 502;
    return json(
      payload && typeof payload === "object"
        ? payload
        : { message: "Support is temporarily unavailable. Try again.", code: "SUPPORT_UNAVAILABLE" },
      safeStatus,
    );
  }
  return json(payload, 200);
}
