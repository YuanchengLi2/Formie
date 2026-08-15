import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

import { loadAdminDashboard } from "./load-dashboard";

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
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (values) => {
        for (const { name, value, options } of values) {
          try { cookieStore.set(name, value, options); } catch { /* Server Components cannot mutate cookies. */ }
        }
      },
    },
  });
}

export async function loadRuntimeAdminDashboard() {
  const authClient = await createCookieClient();
  const adminClient = createClient(supabaseUrl(), required("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return loadAdminDashboard({
    getAuthenticatedEmail: async () => {
      const { data, error } = await authClient.auth.getUser();
      if (error || !data.user) return null;
      return data.user.email ?? null;
    },
    getSnapshot: async () => {
      const { data, error } = await adminClient.rpc("get_founder_dashboard_snapshot");
      if (error) throw new Error(`Dashboard query failed: ${error.message}`);
      return data;
    },
  }, process.env.FORMIE_ADMIN_EMAIL);
}
