import assert from "node:assert/strict";
import test from "node:test";

import { normalizeSubscriptionStore, recordWebsiteSubscriptionIntent } from "./subscription-intent";

test("normalizes provider stores for privacy-safe intent persistence", () => {
  assert.equal(normalizeSubscriptionStore("app_store"), "app_store");
  assert.equal(normalizeSubscriptionStore("play_store"), "play_store");
  assert.equal(normalizeSubscriptionStore("test_store"), "test_store");
  assert.equal(normalizeSubscriptionStore("stripe"), "unknown");
});

test("records a website cancellation reason through the dedicated RPC", async () => {
  const rpc = async (name: string, args: Record<string, unknown>) => {
    assert.equal(name, "record_subscription_management_intent");
    assert.deepEqual(args, {
      p_action: "cancel",
      p_reason: "too_expensive",
      p_surface: "website",
      p_store: "app_store",
    });
    return { error: null };
  };
  await recordWebsiteSubscriptionIntent({ rpc } as never, { action: "cancel", reason: "too_expensive", store: "app_store" });
});

test("never forwards a cancellation reason for a resume intent", async () => {
  const rpc = async (_name: string, args: Record<string, unknown>) => {
    assert.equal(args.p_action, "resume");
    assert.equal(args.p_reason, null);
    return { error: null };
  };
  await recordWebsiteSubscriptionIntent({ rpc } as never, { action: "resume", reason: "other", store: "play_store" });
});
