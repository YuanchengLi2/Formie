import { ensureAnalysisAccess } from "./ensure-analysis-access";
import type { AccessStatus } from "./types";

const active: AccessStatus = {
  status: "active",
  canAnalyze: true,
  quotaUsed: 1,
  quotaLimit: 10,
  remaining: 9,
  periodStartsAt: null,
  periodEndsAt: null,
  entitlementId: "formie_pro",
  source: "revenuecat",
  refreshedAt: "2026-08-04T00:00:00.000Z",
};

describe("analysis access resolution", () => {
  it("refreshes unknown access instead of treating a loading state as denial", async () => {
    const refresh = jest.fn(async () => active);
    await expect(ensureAnalysisAccess({ status: "loading", access: { ...active, status: "unknown", canAnalyze: false }, refresh })).resolves.toEqual(active);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("rejects only a confirmed access denial", async () => {
    const expired = { ...active, status: "expired" as const, canAnalyze: false };
    await expect(ensureAnalysisAccess({ status: "ready", access: expired, refresh: jest.fn() })).rejects.toThrow("active Formie subscription");
  });
});
