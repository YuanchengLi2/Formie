import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { reportingFetch } from "../reporting/request";

function required(name: string, fallbacks: string[] = []): string {
  for (const key of [name, ...fallbacks]) {
    const value = process.env[key]?.trim();
    if (value) return value;
  }
  throw new Error(`Missing ${name}`);
}

export function supabaseUrl() {
  return required("NEXT_PUBLIC_SUPABASE_URL", ["SUPABASE_URL", "EXPO_PUBLIC_SUPABASE_URL"]);
}

export function supabaseAnonKey() {
  return required("NEXT_PUBLIC_SUPABASE_ANON_KEY", ["SUPABASE_ANON_KEY", "EXPO_PUBLIC_SUPABASE_ANON_KEY"]);
}

export async function createCookieClient() {
  const cookieStore = await cookies();
  return createServerClient(supabaseUrl(), supabaseAnonKey(), {
    global: { fetch: reportingFetch },
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (values) => {
        for (const { name, value, options } of values) {
          try {
            cookieStore.set(name, value, {
              ...options,
              httpOnly: true,
              sameSite: "lax",
              secure: process.env.NODE_ENV === "production",
              path: "/",
              maxAge: Math.min(typeof options.maxAge === "number" ? options.maxAge : 8 * 60 * 60, 8 * 60 * 60),
            });
          } catch { /* Server Components cannot mutate cookies. */ }
        }
      },
    },
  });
}

export function createServiceClient() {
  return createClient(supabaseUrl(), required("SUPABASE_SERVICE_ROLE_KEY"), { global: { fetch: reportingFetch }, auth: { persistSession: false, autoRefreshToken: false } });
}
