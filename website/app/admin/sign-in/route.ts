import { NextResponse } from "next/server";

import { isAdminEmail } from "@/lib/admin/access";
import { consumeAdminLoginAttempt } from "@/lib/admin/login-rate-limit";
import { createCookieClient } from "@/lib/admin/supabase-runtime";
import { enforceSameOrigin, readBoundedUrlEncodedForm } from "@/lib/request-security";

function loginUrl(request: Request, error: string) {
  return new URL(`/admin/login?error=${error}`, request.url);
}

export async function POST(request: Request) {
  const rejected = enforceSameOrigin(request);
  if (rejected) return NextResponse.redirect(loginUrl(request, "invalid"), 303);
  const observedIp = request.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!consumeAdminLoginAttempt(observedIp)) return NextResponse.redirect(loginUrl(request, "invalid"), 303);
  let form: URLSearchParams;
  try {
    form = await readBoundedUrlEncodedForm(request, 4_096);
  } catch {
    return NextResponse.redirect(loginUrl(request, "invalid"), 303);
  }
  const email = String(form.get("email") ?? "").trim();
  const password = String(form.get("password") ?? "");
  if (!email || !password) return NextResponse.redirect(loginUrl(request, "invalid"), 303);

  try {
    const supabase = await createCookieClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user) return NextResponse.redirect(loginUrl(request, "invalid"), 303);
    if (!isAdminEmail(data.user.email, process.env.FORMIE_ADMIN_EMAIL)) {
      await supabase.auth.signOut();
      return NextResponse.redirect(loginUrl(request, "invalid"), 303);
    }
    return NextResponse.redirect(new URL("/admin", request.url), 303);
  } catch {
    return NextResponse.redirect(loginUrl(request, "invalid"), 303);
  }
}
