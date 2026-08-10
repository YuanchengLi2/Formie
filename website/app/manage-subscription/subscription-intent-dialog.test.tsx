import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import { NativeSubscriptionHandoff, SubscriptionIntentDialog } from "./subscription-intent-dialog";

test("renders the cancellation warning and reason-flow entry point", () => {
  const html = renderToStaticMarkup(<SubscriptionIntentDialog visible action="cancel" onClose={() => undefined} onExecute={async () => undefined} />);
  assert.match(html, /Are you sure you want to cancel your subscription\?/);
  assert.match(html, /turns automatic renewal off/i);
  assert.match(html, /does not reset/i);
  assert.match(html, /No, keep subscription/);
  assert.match(html, />Continue</);
  assert.doesNotMatch(html, /Not using it enough/);
});

test("renders the resubscribe confirmation without cancellation reasons", () => {
  const html = renderToStaticMarkup(<SubscriptionIntentDialog visible action="resume" paidThrough="2026-09-01T08:56:00Z" onClose={() => undefined} onExecute={async () => undefined} />);
  assert.match(html, /Are you sure you want to resubscribe\?/);
  assert.match(html, /turns automatic renewal back on/i);
  assert.match(html, /does not reset or refill/i);
  assert.match(html, /Sep 1, 2026 at .* (?:EDT|EST|UTC|GMT)/);
  assert.match(html, /Continue to provider/);
  assert.doesNotMatch(html, /Why are you cancelling\?|Not using it enough/);
});

test("Apple sandbox handoff opens Formie and does not claim cancellation is complete", () => {
  const html = renderToStaticMarkup(<SubscriptionIntentDialog visible action="cancel" provider="Apple App Store" opensNativeApp paidThrough="2026-08-11T02:34:50Z" onClose={() => undefined} onExecute={async () => undefined} />);
  assert.match(html, /native subscription sheet/i);
  assert.match(html, /Sandbox Apple Account/i);
  assert.match(html, /only after Apple confirms/i);
  assert.match(html, /opens Formie/i);
  assert.doesNotMatch(html, /cancellation confirmed/i);
});

test("desktop Apple sandbox handoff explicitly tells the tester to continue on iPhone", () => {
  const html = renderToStaticMarkup(<NativeSubscriptionHandoff outcome="continue_on_iphone" onClose={() => undefined} />);
  assert.match(html, /Continue on your iPhone/i);
  assert.match(html, /open this page in Safari/i);
  assert.match(html, /Sandbox Apple Account/i);
  assert.doesNotMatch(html, /Cancellation confirmed/i);
});

test("iPhone Apple sandbox handoff explains the native sheet and offers a retry", () => {
  const html = renderToStaticMarkup(<NativeSubscriptionHandoff outcome="native_app_opened" onClose={() => undefined} />);
  assert.match(html, /Formie should be opening/i);
  assert.match(html, /Apple.*native subscription sheet/i);
  assert.match(html, /href="form:\/\/account\/manage-subscription"/i);
  assert.match(html, /Open Formie again/i);
  assert.doesNotMatch(html, /Cancellation confirmed/i);
});
