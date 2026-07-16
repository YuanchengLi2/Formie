import { supabase } from "@/lib/supabase";

export async function getAccessToken(): Promise<string> {
  const existing = await supabase.auth.getSession();
  if (existing.data.session?.access_token) return existing.data.session.access_token;

  const created = await supabase.auth.signInAnonymously();
  if (created.error || !created.data.session?.access_token) {
    throw new Error(created.error?.message ?? "A private session could not be created");
  }
  return created.data.session.access_token;
}
