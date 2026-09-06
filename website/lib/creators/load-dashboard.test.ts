import assert from "node:assert/strict";
import test from "node:test";

import { parseCreatorDashboard } from "./load-dashboard";

const metric = (value: number | null, unit: "count" | "percent" = "count") => ({
  value,
  unit,
  quality: value === null ? "unavailable" : "exact",
  settlement: "not_applicable",
  currency: null,
  numerator: null,
  denominator: null,
  observedSince: null,
  asOf: "2026-09-05T00:00:00.000Z",
  definition: "Fixture definition",
});

function response() {
  return {
    generatedAt: "2026-09-05T00:00:00.000Z",
    window: "30d",
    creator: { displayName: "Alex", status: "active", creatorCode: "ALEX", rateBasisPoints: 1500 },
    metrics: { visits: metric(10), recovered: metric(8), accounts: metric(4), paid: metric(2), paidConversion: metric(50, "percent"), bonusRecipients: metric(2) },
    earningsByCurrency: [{ currency: "USD", pending: 1.5, payable: 2, paid: 3, adjustments: -0.5 }],
    referrals: [],
    referralPagination: { total: 0, limit: 50, offset: 0, hasMore: false },
    payouts: [],
  };
}

test("parses quality-aware creator metrics and bounded referral pagination", () => {
  const parsed = parseCreatorDashboard(response());
  assert.equal(parsed.metrics.paidConversion?.value, 50);
  assert.equal(parsed.creator.creatorCode, "ALEX");
  assert.equal(parsed.metrics.paidConversion?.quality, "exact");
  assert.deepEqual(parsed.referralPagination, { total: 0, limit: 50, offset: 0, hasMore: false });
  assert.equal(parsed.earningsByCurrency[0]?.adjustments, -0.5);
});

test("never turns missing or malformed creator earnings into a financial zero", () => {
  for (const pending of [null, "", "   ", false, [], {}]) {
    const payload = response();
    Object.assign(payload.earningsByCurrency[0]!, { pending });
    assert.throws(() => parseCreatorDashboard(payload), /pending earnings is invalid/);
  }
  const payload = response();
  Object.assign(payload.earningsByCurrency[0]!, { pending: "0" });
  assert.equal(parseCreatorDashboard(payload).earningsByCurrency[0]?.pending, 0);
});

test("rejects legacy raw creator metrics and missing pagination metadata", () => {
  const legacy = response() as Record<string, unknown>;
  legacy.metrics = { visits: 10, recovered: 8, accounts: 4, paid: 2, paidConversion: 50, bonusRecipients: 2 };
  assert.throws(() => parseCreatorDashboard(legacy), /Reporting response is invalid/);
  const missingPagination = response() as Record<string, unknown>;
  delete missingPagination.referralPagination;
  assert.throws(() => parseCreatorDashboard(missingPagination), /Creator reporting response is invalid/);
});
