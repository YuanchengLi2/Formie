import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { ManageSubscriptionClient } from "./manage-subscription-client";

test("signed-out portal offers Apple and Google with recognizable icons", () => { const html = renderToStaticMarkup(<ManageSubscriptionClient initialDashboard={null} />); assert.match(html, /Continue with Apple/); assert.match(html, /Continue with Google/); assert.match(html, /apple-provider\.png/); assert.match(html, /google-provider\.png/); assert.match(html, /alt="Apple"/); assert.match(html, /alt="Google"/); assert.doesNotMatch(html, /email.*input|password/i); });
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
test("renewing account has a permanent cancellation action and no deletion action", () => { const html = renderToStaticMarkup(<ManageSubscriptionClient initialDashboard={{ account: { email: "u@example.com", displayName: "Yuan", profileExists: true }, usage: { status: "active", used: 2, limit: 10, remaining: 8, periodStart: "2026-08-01T00:00:00Z", resetsAt: "2026-09-01T00:00:00Z" }, subscription: { state: "active_renewing", productIdentifier: "monthly", store: "app_store", paidThrough: "2026-09-01T00:00:00Z", cancelUrl: "https://apple.test", renewalUrl: null, sandbox: false } }} />); assert.equal((html.match(/Cancel Subscription/g) ?? []).length, 1); assert.match(html, /8/); assert.match(html, /2 used/); assert.doesNotMatch(html, /Delete Formie account/); });
test("cancelled account shows its paid-through date and resubscribe action", () => { const html = renderToStaticMarkup(<ManageSubscriptionClient initialDashboard={{ account: { email: null, displayName: "Yuan", profileExists: true }, usage: { status: "active", used: 2, limit: 10, remaining: 8, periodStart: "2026-08-01T00:00:00Z", resetsAt: "2026-09-01T00:00:00Z" }, subscription: { state: "active_cancelled", productIdentifier: "monthly", store: "play_store", paidThrough: "2026-09-01T00:00:00Z", cancelUrl: null, renewalUrl: "https://play.google.com/store/account/subscriptions", sandbox: false } }} />); assert.match(html, /ACCESS ENDS ON/); assert.match(html, /Manage or Resubscribe/); assert.doesNotMatch(html, /Cancel Subscription/); });
test("active zero quota stays subscribed and shows its reset date", () => { const html = renderToStaticMarkup(<ManageSubscriptionClient initialDashboard={{ account: { email: null, displayName: "Yuan", profileExists: true }, usage: { status: "active", used: 10, limit: 10, remaining: 0, periodStart: "2026-08-01T00:00:00Z", resetsAt: "2026-09-01T00:00:00Z" }, subscription: { state: "active_renewing", productIdentifier: "monthly", store: "app_store", paidThrough: "2026-09-01T00:00:00Z", cancelUrl: "https://apple.test", renewalUrl: null, sandbox: false } }} />); assert.match(html, /0 of 10 analyses remaining/); assert.match(html, /10 used/); assert.match(html, /Sep 1, 2026/); assert.doesNotMatch(html, /Resubscribe in the App/); });
test("expired account is directed to repurchase in the Formie app", () => {
  const html = renderToStaticMarkup(<ManageSubscriptionClient initialDashboard={{ account: { email: "u@example.com", displayName: "Yuan", profileExists: true }, usage: { status: "expired", used: 10, limit: 10, remaining: 0, periodStart: null, resetsAt: null }, subscription: { state: "expired", productIdentifier: "monthly", store: "play_store", paidThrough: "2026-08-01T00:00:00Z", cancelUrl: null, renewalUrl: "https://play.google.com/store/account/subscriptions", sandbox: false } }} />);

  assert.match(html, /Your subscription has ended/i);
  assert.match(html, /Open Formie to resubscribe/i);
  assert.match(html, /form:\/\/subscription/);
  assert.doesNotMatch(html, />Expired<|ANALYSES REMAINING|Manage Subscription|Account navigation/i);
});
test("expired account without a store URL is still directed to the app", () => {
  const html = renderToStaticMarkup(<ManageSubscriptionClient initialDashboard={{ account: { email: "u@example.com", displayName: "Yuan", profileExists: true }, usage: { status: "expired", used: 0, limit: 10, remaining: 0, periodStart: null, resetsAt: null }, subscription: { state: "expired", productIdentifier: "monthly", store: "test_store", paidThrough: "2026-08-01T00:00:00Z", cancelUrl: null, renewalUrl: null, sandbox: true } }} />);

  assert.match(html, /Open Formie to resubscribe/i);
  assert.match(html, /Contact support/i);
  assert.doesNotMatch(html, /Test Store subscriptions do not have an end-user cancellation page|Resubscribe in the App|Account navigation/i);
});
