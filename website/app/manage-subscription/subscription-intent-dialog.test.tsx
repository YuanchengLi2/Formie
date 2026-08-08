import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import { SubscriptionIntentDialog } from "./subscription-intent-dialog";

test("renders the cancellation warning and reason-flow entry point", () => {
  const html = renderToStaticMarkup(<SubscriptionIntentDialog visible action="cancel" onClose={() => undefined} onExecute={async () => undefined} />);
  assert.match(html, /Are you sure you want to cancel your subscription\?/);
  assert.match(html, /turns automatic renewal off/i);
  assert.match(html, /does not reset/i);
  assert.match(html, /No, keep subscription/);
  assert.match(html, /Yes, cancel subscription/);
  assert.doesNotMatch(html, /Not using it enough/);
});

test("renders the resubscribe confirmation without cancellation reasons", () => {
  const html = renderToStaticMarkup(<SubscriptionIntentDialog visible action="resume" paidThrough="2026-09-01T08:56:00Z" onClose={() => undefined} onExecute={async () => undefined} />);
  assert.match(html, /Are you sure you want to resubscribe\?/);
  assert.match(html, /turns automatic renewal back on/i);
  assert.match(html, /does not reset or refill/i);
  assert.match(html, /Sep 1, 2026 at .* (?:EDT|EST|UTC|GMT)/);
  assert.match(html, /Yes, resubscribe/);
  assert.doesNotMatch(html, /Why are you cancelling\?|Not using it enough/);
});
