import { NextResponse } from "next/server";
import { createCookieClient, createServiceClient } from "@/lib/admin/supabase-runtime";
import { enforceSameOrigin, publicRequestOrigin, readBoundedUrlEncodedForm } from "@/lib/request-security";

function safeNext(value: string | null) {
  return value?.startsWith("/creators") && !value.startsWith("//") ? value : "/creators";
}
function redirectResponse(request: Request, path: string) {
  return NextResponse.redirect(new URL(path, publicRequestOrigin(request)), { status: 303, headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
}

async function keyHash(request: Request, email: string) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const bytes = new TextEncoder().encode(forwarded + "|" + email);
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))).map((value) => value.toString(16).padStart(2, "0")).join("");
}

async function allow(request: Request, email: string, action: "login" | "recovery", limit: number) {
  const { data, error } = await createServiceClient().rpc("consume_creator_auth_rate_limit", { p_key_hash: await keyHash(request, email), p_action: action, p_window_seconds: 900, p_max_attempts: limit });
  return !error && data === true;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const client = await createCookieClient();
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  let error: unknown = null;
  if (code) ({ error } = await client.auth.exchangeCodeForSession(code));
  else if (tokenHash && type === "invite") ({ error } = await client.auth.verifyOtp({ token_hash: tokenHash, type: "invite" }));
  else if (tokenHash && type === "recovery") ({ error } = await client.auth.verifyOtp({ token_hash: tokenHash, type: "recovery" }));
  else error = new Error("Invalid authentication callback");
  return redirectResponse(request, error ? "/creators/login?error=invalid" : safeNext(url.searchParams.get("next")));
}

export async function POST(request: Request) {
  if (enforceSameOrigin(request)) return redirectResponse(request, "/creators/login?error=invalid");
  try {
    const form = await readBoundedUrlEncodedForm(request, 4096);
    const action = String(form.get("action") ?? "login");
    const email = String(form.get("email") ?? "").trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("Invalid email");
    if (action === "recovery") {
      if (!(await allow(request, email, "recovery", 4))) return redirectResponse(request, "/creators/login?error=rate_limited");
      const client = await createCookieClient();
      const redirectTo = new URL("/creators/auth?type=recovery&next=/creators/account", publicRequestOrigin(request)).toString();
      await client.auth.resetPasswordForEmail(email, { redirectTo });
      return redirectResponse(request, "/creators/login?recovery=sent");
    }
    if (!(await allow(request, email, "login", 8))) return redirectResponse(request, "/creators/login?error=rate_limited");
    const password = String(form.get("password") ?? "");
    const client = await createCookieClient();
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error || !data.user) return redirectResponse(request, "/creators/login?error=invalid");
    const { data: membership } = await client.rpc("get_my_creator_membership");
    if (!Array.isArray(membership) || membership.length === 0) {
      await client.auth.signOut();
      return redirectResponse(request, "/creators/login?error=invalid");
    }
    return redirectResponse(request, "/creators");
  } catch {
    return redirectResponse(request, "/creators/login?error=invalid");
  }
}
