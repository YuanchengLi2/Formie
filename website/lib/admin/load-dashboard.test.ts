import assert from "node:assert/strict";
import test from "node:test";

import { AdminAccessError, loadAdminDashboard } from "./load-dashboard";

const rawSnapshot = {
  generatedAt: "2026-08-14T12:00:00.000Z",
  metrics: {
    totalUsers: 1, newUsersToday: 1, newUsers7d: 1, newUsers30d: 1, dau: 1, wau: 1,
    analysesToday: 0, analyses7d: 0, totalAnalyses: 0, secondAnalysisRate: 0,
    payingSubscribers: 0, freeToPaidRate: null, estimatedMrr: null, cancellations: 0,
    aiCostMonth: null, analysisSuccessRate: 0, helpfulRate: null, helpfulVotes: 0, unhelpfulVotes: 0,
  },
  funnel: [], recentUsers: [], recentAnalyses: [],
  accuracy: {
    aiCost: { status: "unavailable", pricedCalls: 0, totalCalls: 0, coveragePercent: null, unpricedCalls: 0, isMinimum: false },
    revenue: { status: "unavailable", pricedSubscriptions: 0, totalSubscriptions: 0, coveragePercent: null },
    funnel: { status: "exact", observedSince: "2026-08-04T00:00:00.000Z", ordered: true },
  },
};

test("loads privileged dashboard data only after founder identity is verified", async () => {
  let snapshotCalls = 0;
  const result = await loadAdminDashboard({
    getAuthenticatedEmail: async () => "YUANCHENGLI612@gmail.com",
    getSnapshot: async () => { snapshotCalls += 1; return rawSnapshot; },
  }, "yuanchengli612@gmail.com");

  assert.equal(result.adminEmail, "YUANCHENGLI612@gmail.com");
  assert.equal(result.snapshot.metrics.totalUsers, 1);
  assert.equal(snapshotCalls, 1);
});

test("never calls the privileged query for a missing or non-admin session", async () => {
  let snapshotCalls = 0;
  for (const email of [null, "intruder@example.com"]) {
    await assert.rejects(
      loadAdminDashboard({
        getAuthenticatedEmail: async () => email,
        getSnapshot: async () => { snapshotCalls += 1; return rawSnapshot; },
      }, "yuanchengli612@gmail.com"),
      (error: unknown) => error instanceof AdminAccessError,
    );
  }
  assert.equal(snapshotCalls, 0);
});
