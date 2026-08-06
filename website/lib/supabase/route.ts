import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { NextRequest, NextResponse } from "next/server";

type CookieValue = { name: string; value: string; options: CookieOptions };

export function createRouteCookieAdapter(request: NextRequest, response: NextResponse) {
  return {
    getAll: () => request.cookies.getAll().map(({ name, value }) => ({ name, value })),
    setAll: (values: CookieValue[], headers: Record<string, string> = {}) => {
      values.forEach(({ name, value, options }) => response.cookies.set({ name, value, ...options }));
      Object.entries(headers).forEach(([name, value]) => response.headers.set(name, value));
    },
  };
}

export function createRouteSupabaseClient(request: NextRequest, response: NextResponse) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Formie account access is not configured.");
  return createServerClient(url, key, { cookies: createRouteCookieAdapter(request, response) });
}
