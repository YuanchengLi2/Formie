"use client";

import Image from "next/image";
import { useCallback, useEffect, useState, type CSSProperties, type ReactNode } from "react";

import { AccountPortalShell } from "@/components/account-portal-shell";
import { parseAccountDashboard, type AccountDashboardResponse } from "@/lib/account-dashboard";
import { beginWebsiteOAuth } from "@/lib/oauth-redirect";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

function date(value: string | null) {
  return value ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(value)) : "Not available";
}

function storeName(store: string | null) {
  if (store === "app_store" || store === "mac_app_store") return "Apple App Store";
  if (store === "play_store") return "Google Play";
  if (store === "test_store") return "RevenueCat Test Store";
  return "App store";
}

type Props = { initialDashboard: AccountDashboardResponse | null; initialAuthenticated?: boolean; initialError?: string | null };

function PortalPopup({ title, message, detail, actions }: { title: string; message: string; detail?: string; actions: ReactNode }) {
  return <section className="account-portal portal-popup-page"><div className="portal-popup-backdrop"><div className="portal-popup" role="dialog" aria-modal="true" aria-labelledby="portal-popup-title" aria-describedby="portal-popup-message"><span className="portal-kicker">FORMIE ACCOUNT</span><h1 id="portal-popup-title">{title}</h1><p id="portal-popup-message">{message}</p>{detail ? <p className="portal-popup-detail">{detail}</p> : null}<div className="portal-popup-actions">{actions}</div></div></div></section>;
}

function UsageMeter({ remaining, limit }: { remaining: number; limit: number }) {
  const percentage = limit > 0 ? Math.max(0, Math.min(100, (remaining / limit) * 100)) : 0;
  return <div className="quota-meter" role="meter" aria-label={`${remaining} of ${limit} analyses remaining`} aria-valuemin={0} aria-valuemax={limit} aria-valuenow={remaining} style={{ "--quota-progress": `${percentage * 3.6}deg` } as CSSProperties}><span>{remaining}</span><small>left</small></div>;
}

export function ManageSubscriptionClient({ initialDashboard, initialAuthenticated = false, initialError = null }: Props) {
  const [dashboard, setDashboard] = useState(initialDashboard);
  const [error, setError] = useState(initialError);
  const [busy, setBusy] = useState<"apple" | "google" | "logout" | "refresh" | null>(null);
  const hasDashboard = dashboard !== null;

  const refreshDashboard = useCallback(async () => {
    setBusy((current) => current ?? "refresh");
    try {
      const client = createBrowserSupabaseClient();
      const { data, error: invokeError } = await client.functions.invoke("account-dashboard", { method: "GET" });
      if (invokeError) throw invokeError;
      setDashboard(parseAccountDashboard(data));
      setError(null);
    } catch {
      setError("Your subscription could not be refreshed. Your last confirmed balance is still shown.");
    } finally {
      setBusy((current) => current === "refresh" ? null : current);
    }
  }, []);

  useEffect(() => {
    if (!hasDashboard) return;
    const client = createBrowserSupabaseClient();
    let userId: string | null = null;
    let channel: ReturnType<typeof client.channel> | null = null;
    void client.auth.getUser().then(({ data }) => {
      userId = data.user?.id ?? null;
      if (!userId) return;
      const invalidate = () => { void refreshDashboard(); };
      channel = client.channel(`website-access:${userId}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "user_access_entitlements", filter: `user_id=eq.${userId}` }, invalidate)
        .on("postgres_changes", { event: "*", schema: "public", table: "analysis_credit_reservations", filter: `user_id=eq.${userId}` }, invalidate)
        .subscribe();
    });
    const focused = () => { if (document.visibilityState === "visible") void refreshDashboard(); };
    window.addEventListener("focus", focused);
    window.addEventListener("pageshow", focused);
    document.addEventListener("visibilitychange", focused);
    return () => {
      window.removeEventListener("focus", focused);
      window.removeEventListener("pageshow", focused);
      document.removeEventListener("visibilitychange", focused);
      if (channel) void client.removeChannel(channel);
    };
  }, [hasDashboard, refreshDashboard]);

  const login = async (provider: "apple" | "google") => {
    if (busy) return;
    setBusy(provider); setError(null);
    try {
      const client = createBrowserSupabaseClient();
      window.location.assign(await beginWebsiteOAuth(client, provider, window.location.origin));
    } catch {
      setError("Sign in could not be started. Please try again."); setBusy(null);
    }
  };

  const logout = async () => {
    if (busy) return;
    setBusy("logout");
    const client = createBrowserSupabaseClient();
    await client.auth.signOut({ scope: "local" });
    window.location.assign("/manage-subscription");
  };
  const logoutButton = <button className="portal-logout" disabled={Boolean(busy)} onClick={() => void logout()}>{busy === "logout" ? "Signing out..." : "Sign Out"}</button>;

  if (!dashboard && initialAuthenticated) return <PortalPopup title="Something went wrong" message="You signed in, but Formie could not check your account or subscription." detail={error ?? "Please retry, or sign out and use the same account you use in Formie."} actions={<><button className="portal-primary" onClick={() => void refreshDashboard()}>Try again</button>{logoutButton}</>} />;
  if (!dashboard) return <section className="account-portal signed-out"><div className="portal-intro"><span className="portal-kicker">FORMIE ACCOUNT</span><h1>Manage subscription</h1><p>Sign in with the same Apple or Google account you use in Formie.</p>{error ? <p className="portal-error" role="alert">{error}</p> : null}</div><div className="social-login"><button disabled={Boolean(busy)} onClick={() => void login("apple")}><Image className="provider-icon" src="/assets/apple-provider.png" width={26} height={26} alt="Apple" /><span>{busy === "apple" ? "Connecting..." : "Continue with Apple"}</span><i aria-hidden="true" /></button><button disabled={Boolean(busy)} onClick={() => void login("google")}><Image className="provider-icon" src="/assets/google-provider.png" width={26} height={26} alt="Google" /><span>{busy === "google" ? "Connecting..." : "Continue with Google"}</span><i aria-hidden="true" /></button></div></section>;

  if (!dashboard.account.profileExists) return <AccountPortalShell onSignOut={() => void logout()} signingOut={busy === "logout"}><PortalPopup title="No Formie account found" message="This sign-in is valid, but it is not connected to a completed Formie app account." detail="Open Formie and finish creating your account, or sign out and use the same account already used in the app." actions={<><a className="portal-primary" href="form://">Open Formie</a>{logoutButton}</>} /></AccountPortalShell>;

  const subscription = dashboard.subscription;
  const usage = dashboard.usage;
  const subscriptionEnded = subscription.state === "expired" || subscription.state === "not_subscribed";
  if (subscriptionEnded) {
    const subscribedBefore = subscription.state === "expired";
    return <section className="portal-expired-gate">
      <div className="portal-expired-brand"><Image src="/assets/formie-mark.png" width={52} height={52} alt="" priority /><span>FORMIE</span></div>
      <div className="portal-expired-panel">
        <span className="portal-kicker">FORMIE ACCOUNT</span>
        <h1>{subscribedBefore ? "Your subscription has ended" : "Open Formie to subscribe"}</h1>
        <p>Your account and saved coaching remain available in the Formie app. {subscribedBefore ? "Open Formie to resubscribe and create new analyses." : "Subscribe in Formie when you are ready to create analyses."}</p>
        {error ? <div className="portal-refresh-error" role="alert"><span>{error}</span><button onClick={() => void refreshDashboard()}>Retry</button></div> : null}
        <div className="portal-expired-actions">
          <a className="portal-primary" href="form://subscription">{subscribedBefore ? "Open Formie to resubscribe" : "Open Formie"}</a>
          <a className="portal-secondary-link" href="/support">Contact support</a>
          {logoutButton}
        </div>
      </div>
    </section>;
  }

  const active = subscription.state === "active_renewing" || subscription.state === "active_cancelled";
  const renewing = subscription.state === "active_renewing";
  const cancelled = subscription.state === "active_cancelled";
  const managementUrl = renewing ? subscription.cancelUrl : subscription.renewalUrl;
  const managementLabel = renewing ? "Cancel Subscription" : active ? "Manage or Resubscribe" : "Resubscribe in the App";
  const used = usage.used ?? 0;
  const limit = usage.limit ?? 10;
  const remaining = usage.remaining ?? 0;

  return <AccountPortalShell onSignOut={() => void logout()} signingOut={busy === "logout"}>
    <main className="portal-dashboard">
      <header><span className="portal-kicker">FORMIE ACCOUNT</span><h1>Subscription</h1><p>Manage your Formie subscription and plan details.</p></header>
      {error ? <div className="portal-refresh-error" role="alert"><span>{error}</span><button onClick={() => void refreshDashboard()}>Retry</button></div> : null}
      <article className="portal-plan-card">
        <div className="plan-icon">♛</div><div><span>CURRENT PLAN</span><h2>Formie Pro</h2><b className={`plan-pill ${active ? "active" : "expired"}`}>{cancelled ? "Cancelled" : renewing ? "Active" : "Expired"}</b></div>
        <div className="plan-date"><span>{cancelled ? "ACCESS ENDS ON" : renewing ? "RENEWS ON" : "ACCESS ENDED"}</span><strong>{date(subscription.paidThrough)}</strong><small>{cancelled ? "You keep access through this date." : renewing ? "You’ll be charged automatically." : "Renew in the Formie app."}</small></div>
      </article>
      <article className="portal-usage-card"><div><span>ANALYSES REMAINING</span><h2>{remaining} <small>/ {limit}</small></h2><p>{active ? `Resets ${date(usage.resetsAt)} · ${used} used` : "Available after you resubscribe in the app."}</p></div><UsageMeter remaining={remaining} limit={limit} /></article>
      <article className="portal-management-row"><div className="manage-icon">⚙</div><div><h2>Manage Subscription</h2><p>{managementUrl ? `Open ${storeName(subscription.store)} to ${renewing ? "cancel or update payment" : "manage or resubscribe"}.` : subscription.store === "test_store" ? "Test Store subscriptions do not have an end-user cancellation page." : "Purchase or restore in the Formie app."}</p></div>{managementUrl ? <a className="portal-manage-action" href={managementUrl}>{managementLabel}</a> : <a className="portal-manage-action" href="form://subscription">{managementLabel}</a>}</article>
      <footer className="portal-support-line">Questions about your subscription? <a href="/support">Contact support</a></footer>
    </main>
  </AccountPortalShell>;
}
