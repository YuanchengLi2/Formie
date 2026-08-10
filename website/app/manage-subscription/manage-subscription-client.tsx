"use client";

import Image from "next/image";
import { useCallback, useEffect, useState, type CSSProperties, type ReactNode } from "react";

import { AccountPortalShell } from "@/components/account-portal-shell";
import { getAccountDashboard, type AccountDashboardResponse } from "@/lib/account-dashboard";
import { beginWebsiteOAuth } from "@/lib/oauth-redirect";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { SubscriptionIntentDialog } from "./subscription-intent-dialog";
import { recordWebsiteSubscriptionIntent, type CancellationReason, type SubscriptionIntentAction } from "@/lib/subscription-intent";

export function formatDashboardTimestamp(value: string | null, locale = "en-US", timeZone?: string) {
  if (!value) return "Not available";
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return "Not available";
  const zoneOptions = { timeZone: timeZone ?? "UTC" };
  const formattedDate = new Intl.DateTimeFormat(locale, {
    month: "short", day: "numeric", year: "numeric", ...zoneOptions,
  }).format(parsed);
  const formattedTime = new Intl.DateTimeFormat(locale, {
    hour: "numeric", minute: "2-digit", timeZoneName: "short", ...zoneOptions,
  }).format(parsed);
  return `${formattedDate} at ${formattedTime}`;
}

type TestStoreSubscriptionResult = {
  status?: unknown;
  lifecycle_state?: unknown;
  will_renew?: unknown;
  billing_period_start?: unknown;
  billing_period_end?: unknown;
  quota_used?: unknown;
  quota_limit?: unknown;
  remaining?: unknown;
  quota_period_start?: unknown;
  quota_period_end?: unknown;
};

export function applyTestStoreSubscriptionResult(dashboard: AccountDashboardResponse, result: TestStoreSubscriptionResult): AccountDashboardResponse {
  const lifecycleState = result.lifecycle_state;
  if (lifecycleState !== "active_renewing" && lifecycleState !== "active_cancelled") {
    throw new Error("The Test Store returned an invalid subscription state.");
  }
  const billingPeriodStart = typeof result.billing_period_start === "string" ? result.billing_period_start : dashboard.subscription.billingPeriodStart ?? null;
  const billingPeriodEnd = typeof result.billing_period_end === "string" ? result.billing_period_end : dashboard.subscription.paidThrough;
  const quotaPeriodStart = typeof result.quota_period_start === "string" ? result.quota_period_start : dashboard.usage.periodStart;
  const quotaPeriodEnd = typeof result.quota_period_end === "string" ? result.quota_period_end : dashboard.usage.resetsAt;
  const numberOrCurrent = (value: unknown, current: number | null) => Number.isInteger(value) && (value as number) >= 0 ? value as number : current;
  return {
    ...dashboard,
    subscription: {
      ...dashboard.subscription,
      state: lifecycleState,
      willRenew: typeof result.will_renew === "boolean" ? result.will_renew : lifecycleState === "active_renewing",
      billingPeriodStart,
      paidThrough: billingPeriodEnd,
      cancelUrl: lifecycleState === "active_renewing" ? dashboard.subscription.cancelUrl : null,
      renewalUrl: lifecycleState === "active_cancelled" ? dashboard.subscription.renewalUrl : null,
    },
    usage: {
      ...dashboard.usage,
      status: result.status === "active" ? "active" : dashboard.usage.status,
      used: numberOrCurrent(result.quota_used, dashboard.usage.used),
      limit: numberOrCurrent(result.quota_limit, dashboard.usage.limit),
      remaining: numberOrCurrent(result.remaining, dashboard.usage.remaining),
      periodStart: quotaPeriodStart,
      resetsAt: quotaPeriodEnd,
    },
  };
}

function storeName(store: string | null) {
  if (store === "app_store" || store === "mac_app_store") return "Apple App Store";
  if (store === "play_store") return "Google Play";
  if (store === "test_store") return "RevenueCat Test Store";
  return "App store";
}

export function isAppleSandboxSubscription(subscription: AccountDashboardResponse["subscription"]): boolean {
  return subscription.sandbox === true && (subscription.store === "app_store" || subscription.store === "mac_app_store");
}

export function subscriptionManagementDestination(subscription: AccountDashboardResponse["subscription"], action: SubscriptionIntentAction): string | null {
  if (isAppleSandboxSubscription(subscription)) return "form://account/manage-subscription";
  return action === "cancel" ? subscription.cancelUrl : subscription.renewalUrl;
}

function planDetails(subscription: AccountDashboardResponse["subscription"]) {
  const annual = subscription.planCode === "annual" || /year|annual/i.test(subscription.productIdentifier ?? "");
  return annual
    ? { name: "Formie Pro", fullName: "Formie Pro Annual", interval: "Annual", price: "$99.99 / year" }
    : { name: "Formie Pro", fullName: "Formie Pro Monthly", interval: "Monthly", price: "$9.99 / month" };
}

const MAX_REFRESH_DELAY_MS = 2_147_000_000;

export function nextDashboardRefreshDelay(subscriptionPaidThrough: string | null, quotaResetsAt: string | null, now = Date.now(), subscriptionState?: AccountDashboardResponse["subscription"]["state"]): number | null {
  if (subscriptionState === "renewal_pending") return 5_000;
  const boundary = [subscriptionPaidThrough, quotaResetsAt]
    .filter((value): value is string => Boolean(value))
    .map((value) => new Date(value).getTime())
    .filter((value) => Number.isFinite(value) && value > now)
    .sort((left, right) => left - right)[0];
  if (!Number.isFinite(boundary)) return null;
  return Math.min(MAX_REFRESH_DELAY_MS, Math.max(5_000, boundary - now + 1_000));
}

type Props = { initialDashboard: AccountDashboardResponse | null; initialAuthenticated?: boolean; initialError?: string | null };

function PortalPopup({ title, message, detail, actions }: { title: string; message: string; detail?: string; actions: ReactNode }) {
  return <section className="account-portal portal-popup-page"><div className="portal-popup-backdrop"><div className="portal-popup" role="dialog" aria-modal="true" aria-labelledby="portal-popup-title" aria-describedby="portal-popup-message"><span className="portal-kicker">FORMIE ACCOUNT</span><h1 id="portal-popup-title">{title}</h1><p id="portal-popup-message">{message}</p>{detail ? <p className="portal-popup-detail">{detail}</p> : null}<div className="portal-popup-actions">{actions}</div></div></div></section>;
}

function UsageBar({ remaining, limit }: { remaining: number; limit: number }) {
  const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 0;
  const safeRemaining = Math.max(0, Math.min(safeLimit, Number.isFinite(remaining) ? Math.floor(remaining) : 0));
  const percentage = safeLimit > 0 ? (safeRemaining / safeLimit) * 100 : 0;
  return <div className="usage-bar" role="meter" aria-label={`${safeRemaining} of ${safeLimit} analyses remaining`} aria-valuemin={0} aria-valuemax={safeLimit} aria-valuenow={safeRemaining}>
    <strong>{safeRemaining}/{safeLimit}</strong>
    <div className="usage-bar-track" aria-hidden="true"><span style={{ width: `${percentage}%` } as CSSProperties} /></div>
  </div>;
}

export function ManageSubscriptionClient({ initialDashboard, initialAuthenticated = false, initialError = null }: Props) {
  const [dashboard, setDashboard] = useState(initialDashboard);
  const [error, setError] = useState(initialError);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState<"apple" | "google" | "logout" | "refresh" | "intent" | null>(null);
  const [intentAction, setIntentAction] = useState<SubscriptionIntentAction | null>(null);
  const hasDashboard = dashboard !== null;

  const refreshDashboard = useCallback(async () => {
    setBusy((current) => current ?? "refresh");
    try {
      const client = createBrowserSupabaseClient();
      setDashboard(await getAccountDashboard(client));
      setError(null);
    } catch {
      setError("Your subscription could not be refreshed. Your last confirmed balance is still shown.");
    } finally {
      setBusy((current) => current === "refresh" ? null : current);
    }
  }, []);

  useEffect(() => {
    if (!dashboard || !["active_renewing", "active_cancelled", "renewal_pending"].includes(dashboard.subscription.state)) return;
    const delay = nextDashboardRefreshDelay(dashboard.subscription.paidThrough, dashboard.usage.resetsAt, Date.now(), dashboard.subscription.state);
    if (delay === null) return;
    const timer = window.setTimeout(() => { void refreshDashboard(); }, delay);
    return () => window.clearTimeout(timer);
  }, [dashboard, refreshDashboard]);

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
        .on("postgres_changes", { event: "*", schema: "public", table: "subscription_test_scenarios", filter: `user_id=eq.${userId}` }, invalidate)
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

  const executeSubscriptionChange = async (reason?: CancellationReason) => {
    if (busy || !intentAction || !dashboard) return;
    const action = intentAction;
    setBusy("intent");
    setError(null);
    setMessage(null);
    try {
      const client = createBrowserSupabaseClient();
      await recordWebsiteSubscriptionIntent(client, {
        action,
        reason: action === "cancel" ? reason ?? null : null,
        store: dashboard.subscription.store,
      }).catch(() => undefined);
      const testStore = dashboard.subscription.sandbox && dashboard.subscription.store === "test_store";
      if (testStore) {
        const { data: changeResult, error: invokeError } = await client.functions.invoke("subscription-test-controls", {
          body: { action: action === "cancel" ? "cancel_at_period_end" : "uncancel" },
        });
        if (invokeError) throw invokeError;
        setDashboard((current) => current ? applyTestStoreSubscriptionResult(current, changeResult as TestStoreSubscriptionResult) : current);
        setMessage(action === "cancel" ? "Cancellation confirmed. You keep access through the current paid period." : "Renewal restored for the next Test Store period.");
        return;
      }
      const providerUrl = subscriptionManagementDestination(dashboard.subscription, action);
      if (!providerUrl) throw new Error("Subscription management is unavailable right now.");
      window.location.assign(providerUrl);
    } catch {
      throw new Error(action === "cancel" ? "Cancellation could not be completed. Please try again." : "Resubscription could not be started. Please try again.");
    } finally {
      setBusy(null);
    }
  };
  const openSubscriptionIntent = (action: SubscriptionIntentAction) => {
    if (busy) return;
    setError(null);
    setMessage(null);
    setIntentAction(action);
  };
  const logoutButton = <button className="portal-logout" disabled={Boolean(busy)} onClick={() => void logout()}>{busy === "logout" ? "Signing out..." : "Sign Out"}</button>;

  if (!dashboard && initialAuthenticated) return <PortalPopup title="Something went wrong" message="You signed in, but Formie could not check your account or subscription." detail={error ?? "Please retry, or sign out and use the same account you use in Formie."} actions={<><button className="portal-primary" onClick={() => void refreshDashboard()}>Try again</button>{logoutButton}</>} />;
  if (!dashboard) return <section className="account-portal signed-out"><div className="portal-intro"><span className="portal-kicker">FORMIE ACCOUNT</span><h1>Manage subscription</h1><p>Sign in with the same Apple or Google account you use in Formie.</p>{error ? <p className="portal-error" role="alert">{error}</p> : null}</div><div className="social-login"><button disabled={Boolean(busy)} onClick={() => void login("apple")}><Image className="provider-icon" src="/assets/apple-provider.png" width={44} height={44} alt="Apple" /><span>{busy === "apple" ? "Connecting..." : "Continue with Apple"}</span><i aria-hidden="true" /></button><button disabled={Boolean(busy)} onClick={() => void login("google")}><Image className="provider-icon" src="/assets/google-provider.png" width={44} height={44} alt="Google" /><span>{busy === "google" ? "Connecting..." : "Continue with Google"}</span><i aria-hidden="true" /></button></div></section>;

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
        <p>Your account and saved coaching remain available in the Formie app. {subscribedBefore ? "Contact support if you need help with your account." : "Subscribe in Formie when you are ready to create analyses."}</p>
        <div className="portal-expired-plans" aria-label="Formie Pro monthly plan">
          <div><span>MONTHLY</span><strong>$9.99 / month</strong><p>10 analyses each month</p></div>
        </div>
        {error ? <div className="portal-refresh-error" role="alert"><span>{error}</span><button onClick={() => void refreshDashboard()}>Retry</button></div> : null}
        <div className="portal-expired-actions">
          <a className="portal-primary" href="form://subscription">Resubscribe in Formie</a>
          <a className="portal-secondary-link" href="/support">Contact support</a>
          {logoutButton}
        </div>
      </div>
    </section>;
  }

  const renewing = subscription.state === "active_renewing";
  const cancelled = subscription.state === "active_cancelled";
  const checkingRenewal = subscription.state === "renewal_pending";
  const testStore = subscription.sandbox && subscription.store === "test_store";
  const appleSandbox = isAppleSandboxSubscription(subscription);
  const managementUrl = appleSandbox ? "form://account/manage-subscription" : renewing ? subscription.cancelUrl : subscription.renewalUrl;
  const used = usage.used ?? 0;
  const limit = usage.limit ?? 10;
  const remaining = usage.remaining ?? 0;
  const plan = planDetails(subscription);
  const statusLabel = cancelled ? "Canceled" : checkingRenewal ? "Checking renewal" : "Active";
  const automaticRenewalLabel = renewing ? "On" : cancelled ? "Off" : "Checking";
  const boundaryLabel = cancelled ? "Access until" : checkingRenewal ? "Paid through" : "Next charge";
  const provider = storeName(subscription.store);

  return <AccountPortalShell onSignOut={() => void logout()} signingOut={busy === "logout"}>
    <main className="portal-dashboard">
      <header><h1>Subscription</h1><p>Manage your Formie plan, usage, and billing.</p></header>
      {message ? <div className="portal-refresh-success" role="status">{message}</div> : null}
      {error ? <div className="portal-refresh-error" role="alert"><span>{error}</span><button onClick={() => void refreshDashboard()}>Retry</button></div> : null}
      <article className="portal-plan-card">
        <div className="plan-overview"><span>CURRENT PLAN</span><h2>{plan.name}</h2><p>{plan.interval}</p><strong className="plan-price">{plan.price}</strong><b className={`plan-pill ${cancelled ? "cancelled" : checkingRenewal ? "pending" : "active"}`}>{statusLabel}</b><small>{limit} analyses included every billing period</small></div>
        <div className="plan-date"><span>{cancelled ? "ACCESS ENDS" : checkingRenewal ? "PAID THROUGH" : "NEXT BILLING DATE"}</span><strong>{formatDashboardTimestamp(subscription.paidThrough)}</strong><small>{cancelled ? "Automatic renewal is off. You can continue using Formie Pro until this time." : checkingRenewal ? "Formie is verifying the next paid period before adding a new allowance." : `Automatic renewal is on by default. ${plan.price.split(" / ")[0]} will be billed automatically through ${provider}.`}</small><em>Billing cycle · {plan.interval}</em></div>
      </article>
      <article className="portal-usage-card">
        <div className="usage-summary"><span>USAGE THIS PERIOD</span><UsageBar remaining={remaining} limit={limit} /><p>{remaining === 0 ? "No analyses remaining" : `${remaining} analyses remaining`}</p><small>{used} analyses used this billing period</small></div>
        <div className="usage-boundary"><span>{cancelled ? "ACCESS ENDS ON" : checkingRenewal ? "ALLOWANCE STATUS" : "NEXT RESET"}</span><strong>{checkingRenewal ? "Checking renewal" : formatDashboardTimestamp(cancelled ? subscription.paidThrough : usage.resetsAt)}</strong><small>{cancelled ? (remaining === 0 ? "Resuming renewal does not refill the current period." : "Your current balance remains available until access ends.") : checkingRenewal ? "No new allowance is granted until the paid period is verified." : "A new allowance begins after the paid period renews."}</small></div>
      </article>
      <section className="portal-billing-card" aria-labelledby="billing-details-title">
        <div className="portal-section-heading"><div><h2 id="billing-details-title">Billing details</h2></div><p>Payments are securely processed by {provider}.</p></div>
        <dl className="billing-list">
          <div><dt>Plan</dt><dd>{plan.fullName}</dd></div>
          <div><dt>Price</dt><dd>{plan.price}</dd></div>
          <div><dt>Subscription status</dt><dd><span className={`billing-status ${cancelled ? "cancelled" : checkingRenewal ? "pending" : "active"}`}>{statusLabel}</span></dd></div>
          <div><dt>Automatic renewal</dt><dd><span className={`billing-status ${cancelled ? "cancelled" : checkingRenewal ? "pending" : "active"}`}>{automaticRenewalLabel}</span></dd></div>
          <div><dt>{boundaryLabel}</dt><dd>{formatDashboardTimestamp(subscription.paidThrough)}</dd></div>
          <div><dt>Billing provider</dt><dd>{provider}</dd></div>
        </dl>
      </section>
      {cancelled ? <article className="portal-management-card portal-resume-card">
        <div><h2>Resume your subscription</h2><p>Automatic renewal is off, so your plan won’t renew after {formatDashboardTimestamp(subscription.paidThrough)}. Resume to turn automatic renewal back on. This does not reset or refill your current analysis balance; your current paid period stays unchanged.</p></div>
        <div className="portal-resume-actions">{testStore || appleSandbox ? <button className="portal-manage-action portal-resume-action portal-primary-action" disabled={Boolean(busy)} onClick={() => openSubscriptionIntent("resume")}>Resume Subscription</button> : managementUrl ? <><button className="portal-manage-action portal-resume-action portal-primary-action" disabled={Boolean(busy)} onClick={() => openSubscriptionIntent("resume")}>Resume Subscription</button><a className="portal-secondary-action portal-resume-action" href={managementUrl} rel="noopener noreferrer" target="_blank">Manage billing</a></> : <button className="portal-manage-action portal-resume-action portal-primary-action" disabled={Boolean(busy)} onClick={() => openSubscriptionIntent("resume")}>Resume Subscription</button>}</div>
      </article> : checkingRenewal ? <article className="portal-management-card portal-checking-card"><div><h2>Checking your subscription</h2><p>Formie is confirming the provider’s next paid period. Your allowance will update only after that period is verified.</p></div></article> : <article className="portal-management-card portal-cancel-card"><div><h2>Manage subscription</h2><p>{testStore ? "Automatic renewal is on. Canceling turns it off at the end of the current paid period; your remaining access and analyses stay available until then." : appleSandbox ? "This Apple sandbox subscription must be managed in Formie so iOS uses the Sandbox Apple Account that made the purchase. Apple remains the cancellation authority." : managementUrl ? "Automatic renewal is on by default and your subscription renews automatically on " + formatDashboardTimestamp(subscription.paidThrough) + ". Canceling turns automatic renewal off at period end; select Cancel Subscription to manage it in " + provider + "." : "Manage this subscription in the Formie app."}</p></div><button className="portal-manage-action portal-cancel-action" disabled={Boolean(busy)} onClick={() => openSubscriptionIntent("cancel")}>Cancel Subscription</button></article>}
      <footer className="portal-billing-footer">
        <div><strong>Billing history</strong><p>View receipts and payment history through {provider}.</p>{managementUrl ? <a href={managementUrl} rel="noopener noreferrer" target={appleSandbox ? undefined : "_blank"}>{appleSandbox ? "Manage Apple sandbox subscription →" : "View billing history →"}</a> : <span>Billing history is managed by your subscription provider.</span>}</div>
        <div><strong>Need help with your subscription?</strong><p>Formie does not store your payment details.</p><a href="/support">Contact support →</a></div>
      </footer>
      <SubscriptionIntentDialog key={intentAction ?? "closed"} visible={Boolean(intentAction)} action={intentAction ?? "cancel"} provider={provider} paidThrough={subscription.paidThrough} opensNativeApp={appleSandbox} onClose={() => setIntentAction(null)} onExecute={executeSubscriptionChange} />
    </main>
  </AccountPortalShell>;
}
