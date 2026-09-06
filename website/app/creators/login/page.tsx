import { redirect } from "next/navigation";
import { createCookieClient } from "@/lib/admin/supabase-runtime";

export default async function Page({ searchParams }: { searchParams: Promise<{ error?: string; recovery?: string }> }) {
  const client = await createCookieClient();
  const { data } = await client.auth.getUser();
  if (data.user) redirect("/creators");
  const params = await searchParams;
  return <main className="creator-login"><section><div className="creator-brand"><span>F</span><div><b>Formie creators</b><small>Invite-only portal</small></div></div><h1>See your referrals and earnings.</h1><p>Sign in with the email and password attached to your creator invitation.</p><form action="/creators/auth" method="post"><input type="hidden" name="action" value="login" /><label>Email<input required name="email" type="email" autoComplete="email" /></label><label>Password<input required name="password" type="password" autoComplete="current-password" /></label>{params.error ? <div role="alert">{params.error === "rate_limited" ? "Too many attempts. Try again later." : "Sign-in could not be completed."}</div> : null}<button>Sign in</button></form><details className="creator-recovery"><summary>Forgot password?</summary><form action="/creators/auth" method="post"><input type="hidden" name="action" value="recovery" /><label>Creator email<input required name="email" type="email" autoComplete="email" /></label><button>Send recovery link</button></form>{params.recovery === "sent" ? <p role="status">If this email belongs to a creator account, a recovery link has been sent.</p> : null}</details></section></main>;
}
