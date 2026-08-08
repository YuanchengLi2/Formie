import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { formatDashboardTimestamp, ManageSubscriptionClient, nextDashboardRefreshDelay } from "./manage-subscription-client";

const styles = readFileSync(resolve(__dirname, "../globals.css"), "utf8");
const clientSource = readFileSync(resolve(__dirname, "manage-subscription-client.tsx"), "utf8");

test("dashboard refreshes at the earlier paid-through or quota boundary", () => {
  const now = Date.parse("2026-08-31T23:59:55.000Z");
  assert.equal(nextDashboardRefreshDelay("2026-09-01T00:00:00.000Z", "2026-09-01T00:00:30.000Z", now), 6_000);
  assert.equal(nextDashboardRefreshDelay("2026-08-31T23:59:00.000Z", "2026-09-01T00:00:30.000Z", now), 36_000);
  assert.equal(nextDashboardRefreshDelay("2026-08-31T23:59:00.000Z", "2026-08-31T23:59:01.000Z", now), null);
});
test("renewal-pending dashboards poll again instead of stopping at the old period end", () => {
  assert.equal(nextDashboardRefreshDelay("2026-08-01T00:00:00.000Z", "2026-08-01T00:00:00.000Z", Date.parse("2026-08-08T00:00:00Z"), "renewal_pending"), 5_000);
});

test("dashboard listens for both canonical entitlement and Test Store lifecycle changes", () => {
  assert.match(clientSource, /table:\s*"user_access_entitlements"/);
  assert.match(clientSource, /table:\s*"subscription_test_scenarios"/);
});

test("billing timestamps include exact time and an explicit zone", () => {
  assert.equal(formatDashboardTimestamp("2026-09-07T08:56:00Z", "en-US", "UTC"), "Sep 7, 2026 at 8:56 AM UTC");
});

test("signed-out portal offers Apple and Google with visibly larger icons and buttons", () => { const html = renderToStaticMarkup(<ManageSubscriptionClient initialDashboard={null} />); assert.match(html, /Continue with Apple/); assert.match(html, /Continue with Google/); assert.match(html, /apple-provider\.png/); assert.match(html, /google-provider\.png/); assert.match(html, /width="44" height="44"/); assert.match(styles, /\.social-login button\s*\{[^}]*min-height:\s*68px/); assert.match(styles, /grid-template-columns:\s*44px 1fr 44px/); assert.match(styles, /\.provider-icon\s*\{[^}]*width:\s*44px;[^}]*height:\s*44px/); assert.doesNotMatch(html, /email.*input|password/i); });
test("authenticated dashboard failure opens a blocking popup", () => { const html = renderToStaticMarkup(<ManageSubscriptionClient initialDashboard={null} initialAuthenticated initialError="Your account details could not be loaded." />); assert.match(html, /role="dialog"/); assert.match(html, /Something went wrong/i); assert.match(html, /Try again/i); assert.match(html, /Sign Out/i); });
test("authenticated account without a subscription gets a clean recovery screen", () => {
  const html = renderToStaticMarkup(<ManageSubscriptionClient initialDashboard={{ account: { email: "u@example.com", displayName: "Yuan", profileExists: true }, usage: { status: "expired", used: 0, limit: 10, remaining: 0, periodStart: null, resetsAt: null }, subscription: { state: "not_subscribed", productIdentifier: null, store: null, paidThrough: null, cancelUrl: null, renewalUrl: null, sandbox: false } }} />);

  assert.match(html, /Open Formie to subscribe/i);
  assert.match(html, /Open Formie/i);
  assert.match(html, /Contact support/i);
  assert.match(html, /Sign Out/);
  assert.doesNotMatch(html, /ANALYSES REMAINING|CURRENT PLAN|Account navigation|>Expired</i);
});
test("OAuth identity without a Formie app profile gets a no-account popup without an App Store icon", () => { const html = renderToStaticMarkup(<ManageSubscriptionClient initialDashboard={{ account: { email: "u@example.com", displayName: "Formie Athlete", profileExists: false }, usage: { status: "expired", used: 0, limit: 10, remaining: 0, periodStart: null, resetsAt: null }, subscription: { state: "not_subscribed", productIdentifier: null, store: null, paidThrough: null, cancelUrl: null, renewalUrl: null, sandbox: false } }} />); assert.match(html, /role="dialog"/); assert.match(html, /No Formie account found/i); assert.doesNotMatch(html, /Download on the App Store|download-on-app-store/i); });
test("renewing account renders a compact complete billing portal", () => {
  const html = renderToStaticMarkup(<ManageSubscriptionClient initialDashboard={{ account: { email: "u@example.com", displayName: "Yuan", profileExists: true }, usage: { status: "active", used: 2, limit: 10, remaining: 8, periodStart: "2026-08-01T00:00:00Z", resetsAt: "2026-09-01T00:00:00Z" }, subscription: { state: "active_renewing", planCode: "monthly", productIdentifier: "monthly", store: "app_store", paidThrough: "2026-09-01T00:00:00Z", cancelUrl: "https://apple.test", renewalUrl: null, sandbox: false } }} />);

  assert.match(html, /Manage your Formie plan, usage, and billing/);
  assert.match(html, /Formie Pro/);
  assert.match(html, /\$9\.99 \/ month/);
  assert.match(html, /8\/10/);
  assert.match(html, /usage-bar/);
  assert.match(html, /NEXT RESET/);
  assert.match(html, /2 analyses used/);
  assert.match(html, /Billing details/);
  assert.match(html, /Subscription status/);
  assert.match(html, /Automatic renewal/);
  assert.match(html, />On</);
  assert.match(html, /Apple App Store/);
  assert.match(html, /View billing history/);
  assert.doesNotMatch(html, /plan-icon|quota-meter|>left<|Delete Formie account/);
  assert.doesNotMatch(html, /FORMIE ACCOUNT|ACCOUNT INFRASTRUCTURE|SUBSCRIPTION CONTROLS/);
});
test("renewing Test Store account renders a real cancellation button instead of a dead app deep link", () => {
  const html = renderToStaticMarkup(<ManageSubscriptionClient initialDashboard={{ account: { email: "u@example.com", displayName: "Yuan", profileExists: true }, usage: { status: "active", used: 2, limit: 10, remaining: 8, periodStart: "2026-08-01T00:00:00Z", resetsAt: "2026-09-01T00:00:00Z" }, subscription: { state: "active_renewing", planCode: "monthly", willRenew: true, productIdentifier: "formie_monthly", store: "test_store", paidThrough: "2026-09-01T00:00:00Z", cancelUrl: null, renewalUrl: null, sandbox: true } }} />);

  assert.match(html, /portal-cancel-card/);
  assert.match(html, /<button[^>]*class="portal-manage-action portal-cancel-action"[^>]*>Cancel Subscription<\/button>/);
  assert.match(html, /end of the current paid period/i);
  assert.doesNotMatch(html, /href="form:\/\/subscription"/);
});
test("manage subscription actions use large stacked touch targets", () => {
  assert.match(styles, /\.portal-cancel-action\s*\{[^}]*min-height:\s*56px/);
  assert.match(styles, /\.portal-resume-action\s*\{[^}]*min-height:\s*56px/);
  assert.match(styles, /\.portal-secondary-action\s*\{[^}]*min-height:\s*56px/);
});
test("annual and checking-renewal states render from the server snapshot", () => {
  const html = renderToStaticMarkup(<ManageSubscriptionClient initialDashboard={{ account: { email: "u@example.com", displayName: "Yuan", profileExists: true }, usage: { status: "active", used: 4, limit: 10, remaining: 6, periodStart: "2026-08-01T00:00:00Z", resetsAt: "2026-09-01T00:00:00Z" }, subscription: { state: "renewal_pending", planCode: "annual", willRenew: true, billingPeriodStart: "2026-08-01T00:00:00Z", productIdentifier: "formie_yearly", store: "app_store", paidThrough: "2027-08-01T00:00:00Z", cancelUrl: null, renewalUrl: null, sandbox: false } }} />);
  assert.match(html, /Formie Pro Annual/);
  assert.match(html, /Checking renewal/);
  assert.match(html, /6 of 10 analyses remaining/);
  assert.doesNotMatch(html, /VERIFYING RENEWAL/);
});
test("cancelled account shows access ending, automatic renewal off, and the resume hierarchy", () => { const html = renderToStaticMarkup(<ManageSubscriptionClient initialDashboard={{ account: { email: null, displayName: "Yuan", profileExists: true }, usage: { status: "active", used: 2, limit: 10, remaining: 8, periodStart: "2026-08-01T00:00:00Z", resetsAt: "2026-09-01T00:00:00Z" }, subscription: { state: "active_cancelled", planCode: "monthly", productIdentifier: "monthly", store: "play_store", paidThrough: "2026-09-01T00:00:00Z", cancelUrl: null, renewalUrl: "https://play.google.com/store/account/subscriptions", sandbox: false } }} />); assert.match(html, /ACCESS ENDS ON/); assert.match(html, /portal-resume-card/); assert.match(html, /Resume your subscription/); assert.match(html, /Resume Subscription/); assert.match(html, /Manage billing/); assert.match(html, /Billing details/); assert.match(html, /Automatic renewal/); assert.match(html, />Off</); assert.match(html, /turn automatic renewal back on/i); assert.match(html, /does not reset or refill/i); assert.match(html, /Access until/); assert.match(html, /Google Play/); assert.match(html, /8\/10/); assert.doesNotMatch(html, /KEEP FORMIE PRO|SUBSCRIPTION CONTROLS|ACCOUNT INFRASTRUCTURE|FORMIE ACCOUNT|Cancel Subscription|NEXT RESET|Resets/); });
test("active zero quota stays subscribed and shows its exact reset time", () => { const html = renderToStaticMarkup(<ManageSubscriptionClient initialDashboard={{ account: { email: null, displayName: "Yuan", profileExists: true }, usage: { status: "active", used: 10, limit: 10, remaining: 0, periodStart: "2026-08-01T00:00:00Z", resetsAt: "2026-09-01T00:00:00Z" }, subscription: { state: "active_renewing", productIdentifier: "monthly", store: "app_store", paidThrough: "2026-09-01T00:00:00Z", cancelUrl: "https://apple.test", renewalUrl: null, sandbox: false } }} />); assert.match(html, /0 of 10 analyses remaining/); assert.match(html, /10 analyses used/); assert.match(html, /NEXT RESET/); assert.match(html, /2026 at .*\b(?:UTC|GMT|[A-Z]{2,5})\b/); assert.doesNotMatch(html, /Resubscribe in the App/); });
test("cancelled paid-through account with zero quota never claims a reset", () => { const html = renderToStaticMarkup(<ManageSubscriptionClient initialDashboard={{ account: { email: null, displayName: "Yuan", profileExists: true }, usage: { status: "active", used: 10, limit: 10, remaining: 0, periodStart: "2026-08-01T00:00:00Z", resetsAt: "2026-09-01T00:00:00Z" }, subscription: { state: "active_cancelled", productIdentifier: "monthly", store: "app_store", paidThrough: "2026-09-01T00:00:00Z", cancelUrl: null, renewalUrl: "https://apps.apple.com/account/subscriptions", sandbox: false } }} />); assert.match(html, /ACCESS ENDS ON/); assert.match(html, /0\/10/); assert.match(html, /10 analyses used/); assert.match(html, /Resume Subscription/); assert.match(html, /does not refill/i); assert.doesNotMatch(html, /Cancel Subscription|Your subscription has ended|NEXT RESET|Resets/); });
test("expired account is directed to repurchase in the Formie app", () => {
  const html = renderToStaticMarkup(<ManageSubscriptionClient initialDashboard={{ account: { email: "u@example.com", displayName: "Yuan", profileExists: true }, usage: { status: "expired", used: 10, limit: 10, remaining: 0, periodStart: null, resetsAt: null }, subscription: { state: "expired", productIdentifier: "monthly", store: "play_store", paidThrough: "2026-08-01T00:00:00Z", cancelUrl: null, renewalUrl: "https://play.google.com/store/account/subscriptions", sandbox: false } }} />);

  assert.match(html, /Your subscription has ended/i);
  assert.match(html, /\$9\.99.*month/i);
  assert.doesNotMatch(html, /Annual|\$99\.99|\/ year/i);
  assert.doesNotMatch(html, /Open Formie to resubscribe/i);
  assert.doesNotMatch(html, /form:\/\/subscription/);
  assert.match(html, /Contact support/i);
  assert.doesNotMatch(html, />Expired<|ANALYSES REMAINING|Manage Subscription|Account navigation/i);
});
test("expired account without a store URL is still directed to the app", () => {
  const html = renderToStaticMarkup(<ManageSubscriptionClient initialDashboard={{ account: { email: "u@example.com", displayName: "Yuan", profileExists: true }, usage: { status: "expired", used: 0, limit: 10, remaining: 0, periodStart: null, resetsAt: null }, subscription: { state: "expired", productIdentifier: "monthly", store: "test_store", paidThrough: "2026-08-01T00:00:00Z", cancelUrl: null, renewalUrl: null, sandbox: true } }} />);

  assert.match(html, /Contact support/i);
  assert.doesNotMatch(html, /Annual|\$99\.99|\/ year/i);
  assert.doesNotMatch(html, /Open Formie to resubscribe|form:\/\/subscription/i);
  assert.doesNotMatch(html, /Test Store subscriptions do not have an end-user cancellation page|Resubscribe in the App|Account navigation/i);
});
