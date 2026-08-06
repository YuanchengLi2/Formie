import { NextResponse, type NextRequest } from "next/server";

import { createRouteSupabaseClient } from "@/lib/supabase/route";
import { sanitizedNext } from "./callback-next";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const next = sanitizedNext(request.nextUrl.searchParams.get("next"));
  const destination = new URL(next, request.url);
  if (!code) { destination.searchParams.set("error", "Sign in was not completed. Please try again."); return NextResponse.redirect(destination); }
  try {
    const response = NextResponse.redirect(destination);
    const client = createRouteSupabaseClient(request, response);
    const { data, error } = await client.auth.exchangeCodeForSession(code);
    if (error || !data.session?.user) throw error ?? new Error("No authenticated session was returned");
    return response;
  } catch {
    destination.searchParams.set("error", "Sign in could not be completed. Please try again.");
    return NextResponse.redirect(destination);
  }
}
