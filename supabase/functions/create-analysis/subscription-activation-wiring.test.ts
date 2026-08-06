import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("subscription launch activation wiring", () => {
  it("activates enforcement after the subscription access schema is installed", () => {
    const migrationPath = resolve(__dirname, "../../migrations/202608040004_activate_subscription_launch.sql");
    expect(existsSync(migrationPath)).toBe(true);
    expect(readFileSync(migrationPath, "utf8")).toContain("select public.activate_subscription_launch();");
  });

  it("uses the shared expiry-aware mapping in both entitlement writers", () => {
    const refreshSource = readFileSync(resolve(__dirname, "../refresh-entitlement/index.ts"), "utf8");
    const reconcileSource = readFileSync(resolve(__dirname, "../reconcile-entitlements/index.ts"), "utf8");
    const ledgerSource = readFileSync(resolve(__dirname, "../_shared/entitlement-ledger.ts"), "utf8");

    expect(refreshSource).toContain("persistEntitlementLedger");
    expect(reconcileSource).toContain("persistEntitlementLedger");
    expect(ledgerSource).toContain("resolveRevenueCatEntitlement");
    expect(refreshSource).not.toContain("subscriber.entitlements.find");
    expect(reconcileSource).not.toContain("subscriber.entitlements.find");
  });
});
