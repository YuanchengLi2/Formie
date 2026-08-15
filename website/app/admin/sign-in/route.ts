import { NextResponse } from "next/server";

import { isAdminEmail } from "@/lib/admin/access";
import { createCookieClient } from "@/lib/admin/supabase-runtime";

function loginUrl(request: Request, error: string) {
  return new URL(`/admin/login?error=${error}`, request.url);
}

export async function POST(request: Request) {
  const form = await request.formData();
  const email = String(form.get("email") ?? "").trim();
  const password = String(form.get("password") ?? "");
  if (!email || !password) return NextResponse.redirect(loginUrl(request, "invalid"), 303);

  try {
    const supabase = await createCookieClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user) return NextResponse.redirect(loginUrl(request, "invalid"), 303);
    if (!isAdminEmail(data.user.email, process.env.FORMIE_ADMIN_EMAIL)) {
      await supabase.auth.signOut();
      return NextResponse.redirect(loginUrl(request, "forbidden"), 303);
    }
    return NextResponse.redirect(new URL("/admin", request.url), 303);
  } catch {
    return NextResponse.redirect(loginUrl(request, "config"), 303);
  }
}
