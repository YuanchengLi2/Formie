import { NextResponse } from "next/server";

import { createCookieClient } from "@/lib/admin/supabase-runtime";

export async function POST(request: Request) {
  try {
    const supabase = await createCookieClient();
    await supabase.auth.signOut();
  } catch {
    // A missing or expired session is already signed out.
  }
  return NextResponse.redirect(new URL("/admin/login", request.url), 303);
}
