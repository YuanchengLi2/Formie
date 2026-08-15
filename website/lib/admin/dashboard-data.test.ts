import assert from "node:assert/strict";
import test from "node:test";

import { parseDashboardSnapshot } from "./dashboard-data";

test("normalizes the database snapshot into finite dashboard values", () => {
  const snapshot = parseDashboardSnapshot({
    generatedAt: "2026-08-14T12:00:00.000Z",
    metrics: {
      totalUsers: "42",
      newUsersToday: 3,
      newUsers7d: 11,
      newUsers30d: 29,
      dau: 8,
      wau: 23,
      analysesToday: 6,
      analyses7d: 31,
      totalAnalyses: 77,
      secondAnalysisRate: "38.5",
      payingSubscribers: 9,
      freeToPaidRate: 12.5,
      estimatedMrr: "89.91",
      cancellations: 2,
      aiCostMonth: "14.2841",
      analysisSuccessRate: "96.7",
      helpfulRate: null,
      helpfulVotes: 0,
      unhelpfulVotes: 0,
    },
    funnel: [
      { key: "signup", label: "Signed up", users: "42", conversionFromPrevious: 100, conversionFromSignup: 100 },
      { key: "first_analysis", label: "First analysis", users: 20, conversionFromPrevious: "50", conversionFromSignup: "47.6" },
    ],
    recentUsers: [],
    recentAnalyses: [],
  });

  assert.equal(snapshot.metrics.totalUsers, 42);
  assert.equal(snapshot.metrics.estimatedMrr, 89.91);
  assert.equal(snapshot.metrics.helpfulRate, null);
  assert.equal(snapshot.funnel[1].conversionFromPrevious, 50);
});

test("rejects malformed snapshots instead of displaying invented zeroes", () => {
  assert.throws(() => parseDashboardSnapshot(null), /dashboard snapshot/i);
  assert.throws(() => parseDashboardSnapshot({ metrics: {} }), /generatedAt/i);
});
