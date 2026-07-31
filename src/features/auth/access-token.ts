import { supabase } from "@/lib/supabase";

export class AuthenticationRequiredError extends Error {
  constructor() {
    super("Log in to continue");
    this.name = "AuthenticationRequiredError";
  }
}

export async function getAccessToken(): Promise<string> {
  const existing = await supabase.auth.getSession();
  const session = existing.data.session;
  if (
    session?.access_token
    && session.user.is_anonymous !== true
    && Boolean(session.user.email_confirmed_at)
  ) return session.access_token;
  throw new AuthenticationRequiredError();
}
