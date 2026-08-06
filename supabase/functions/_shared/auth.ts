import { createClient } from "npm:@supabase/supabase-js@2.110.5";

export function createAdminClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceRoleKey) throw new Error("Supabase server configuration is missing");
  return createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
}

export function createUserClient(token: string) {
  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!url || !anonKey) throw new Error("Supabase user configuration is missing");
  return createClient(url, anonKey, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { autoRefreshToken: false, persistSession: false } });
}

export type RequiredUser = { id: string; email: string | null; client: ReturnType<typeof createUserClient> };

export async function requireUser(request: Request, suppliedAdmin?: ReturnType<typeof createAdminClient>, callerFactory: (token: string) => ReturnType<typeof createUserClient> = createUserClient): Promise<RequiredUser> {
  const authorization = request.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) throw new Error("UNAUTHORIZED");
  const token = authorization.slice("Bearer ".length);
  const admin = suppliedAdmin ?? createAdminClient();
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) throw new Error("UNAUTHORIZED");
  return { id: data.user.id, email: data.user.email ?? null, client: callerFactory(token) };
}

export async function requireUserId(request: Request, admin = createAdminClient()): Promise<string> {
  const authorization = request.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) throw new Error("UNAUTHORIZED");
  const token = authorization.slice("Bearer ".length);
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) throw new Error("UNAUTHORIZED");
  return data.user.id;
}
