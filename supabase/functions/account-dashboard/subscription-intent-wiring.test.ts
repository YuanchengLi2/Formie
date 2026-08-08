import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migration = readFileSync(
  resolve(__dirname, "../../migrations/202608070005_subscription_management_intents.sql"),
  "utf8",
);

describe("subscription management intent persistence", () => {
  it("allows the intent event and exposes an authenticated RPC", () => {
    expect(migration).toContain("'subscription_management_intent'");
    expect(migration).toContain("create or replace function public.record_subscription_management_intent");
    expect(migration).toContain("grant execute on function public.record_subscription_management_intent(text, text, text, text) to authenticated");
  });

  it("validates action, reason, surface, and store before writing", () => {
    expect(migration).toContain("p_action not in ('cancel', 'resume')");
    expect(migration).toContain("p_surface not in ('mobile', 'website')");
    expect(migration).toContain("p_store not in ('app_store', 'play_store', 'test_store', 'unknown')");
    expect(migration).toContain("subscription cancellation reason is required");
  });
});
