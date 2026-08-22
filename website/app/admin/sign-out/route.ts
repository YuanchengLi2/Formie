import { NextResponse } from "next/server";

import { createCookieClient } from "@/lib/admin/supabase-runtime";
import { enforceSameOrigin } from "@/lib/request-security";

export async function POST(request: Request) {
  if (enforceSameOrigin(request)) return NextResponse.redirect(new URL("/admin/login", request.url), 303);
  try {
    const supabase = await createCookieClient();
    await supabase.auth.signOut();
  } catch {
    // A missing or expired session is already signed out.
  }
  return NextResponse.redirect(new URL("/admin/login", request.url), 303);
}
