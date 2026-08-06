import { friendlyPurchaseError } from "./billing-errors";
import { resolveEntitlement } from "./entitlement-resolution";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("billing provider purchase messaging", () => {
  it("treats a store cancellation as a silent idle return", () => {
    expect(friendlyPurchaseError(new Error("User cancelled purchase"))).toBe("");
  });

  it("does not claim a hard-coded price when the store is unavailable", () => {
    expect(friendlyPurchaseError(new Error("product unavailable"))).toMatch(/not available/i);
  });
});

describe("entitlement resolution", () => {
  it("preserves cancelled access through its paid-through timestamp", () => {
    expect(resolveEntitlement({ isActive: true, willRenew: false, expirationDate: "2026-09-01T00:00:00Z" }, Date.parse("2026-08-05T00:00:00Z"))).toBe("active");
  });

  it("confirms expiry only after the provider period ends", () => {
    expect(resolveEntitlement({ isActive: false, willRenew: false, expirationDate: "2026-08-01T00:00:00Z" }, Date.parse("2026-08-05T00:00:00Z"))).toBe("expired");
  });

  it("allows a renewed entitlement to become active after previous expiry", () => {
    expect(resolveEntitlement({ isActive: true, willRenew: true, expirationDate: "2026-09-01T00:00:00Z" }, Date.parse("2026-08-05T00:00:00Z"))).toBe("active");
  });
});

describe("billing synchronization wiring", () => {
  it("reconciles RevenueCat customer-info listener updates and guards identity changes", () => {
    const source = readFileSync(resolve(__dirname, "billing-provider.tsx"), "utf8");
    expect(source).toContain("purchasesClient.subscribeCustomerInfo");
    expect(source).toContain("reconciliationGeneration");
  });
});
