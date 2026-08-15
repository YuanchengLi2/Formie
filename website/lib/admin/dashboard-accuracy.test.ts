import assert from "node:assert/strict";
import test from "node:test";

import { enrichDashboardSnapshot } from "./dashboard-accuracy";

const base = {
  generatedAt: "2026-08-14T12:00:00.000Z",
  metrics: {
    totalUsers: 99, newUsersToday: 0, newUsers7d: 0, newUsers30d: 0, dau: 0, wau: 0,
    analysesToday: 0, analyses7d: 0, totalAnalyses: 2, secondAnalysisRate: 0,
    payingSubscribers: 0, freeToPaidRate: 0, estimatedMrr: 0, cancellations: 0,
    aiCostMonth: 0, analysisSuccessRate: 100, helpfulRate: null, helpfulVotes: 0, unhelpfulVotes: 0,
  },
  funnel: [],
  recentUsers: [],
  recentAnalyses: [{
    id: "analysis-2", userEmail: "owner@example.com", exercise: "Squat", status: "Complete",
    createdAt: "2026-08-10T13:00:00.000Z", processingMs: 1000, aiCost: 0, feedback: null,
  }],
};

test("derives an ordered production funnel and auditable financial estimates without a new database RPC", () => {
  const snapshot = enrichDashboardSnapshot(base, {
    now: "2026-08-14T15:00:00.000Z",
    users: [{ id: "user-1", createdAt: "2026-08-05T10:00:00.000Z" }],
    profiles: [{ userId: "user-1", onboardingCompletedAt: "2026-08-05T11:00:00.000Z" }],
    analyses: [
      { id: "analysis-1", userId: "user-1", status: "complete", createdAt: "2026-08-05T12:00:00.000Z", completedAt: "2026-08-05T12:05:00.000Z" },
      { id: "analysis-2", userId: "user-1", status: "complete", createdAt: "2026-08-10T13:00:00.000Z", completedAt: "2026-08-10T13:05:00.000Z" },
    ],
    events: [{ userId: "user-1", eventName: "paywall_viewed", createdAt: "2026-08-05T12:06:00.000Z" }],
    entitlements: [{
      userId: "user-1", status: "active", sandbox: false, entitlementId: "pro",
      storeProductId: "formie_monthly", revenuecatAppUserId: "rc-user-1",
      lifecycleState: "active_renewing", billingPeriodEnd: "2026-09-05T00:00:00.000Z", currentPeriodEnd: null,
    }],
    purchases: [{
      appUserId: "rc-user-1", eventType: "INITIAL_PURCHASE", status: "completed", environment: "PRODUCTION",
      purchasedAt: "2026-08-05T12:07:00.000Z", eventTimestamp: null, completedAt: null, receivedAt: "2026-08-05T12:07:01.000Z",
    }],
    telemetry: [
      { sessionId: "analysis-2", model: "gemini-3.6-flash", createdAt: "2026-08-10T13:00:00.000Z", promptTokens: 1000, outputTokens: 100, thinkingTokens: 100, estimatedCostUsd: null },
      { sessionId: "analysis-2", model: "unknown-model", createdAt: "2026-08-10T13:01:00.000Z", promptTokens: null, outputTokens: null, thinkingTokens: null, estimatedCostUsd: null },
    ],
  });

  assert.deepEqual(snapshot.funnel.map((step) => step.users), [1, 1, 1, 1, 1, 1]);
  assert.equal(snapshot.metrics.totalUsers, 1);
  assert.equal(snapshot.metrics.secondAnalysisRate, 100);
  assert.equal(snapshot.metrics.freeToPaidRate, 100);
  assert.equal(snapshot.metrics.estimatedMrr, 9.99);
  assert.equal(snapshot.accuracy.revenue.status, "estimated");
  assert.equal(snapshot.metrics.aiCostMonth, 0.003);
  assert.deepEqual(snapshot.accuracy.aiCost, {
    status: "incomplete", pricedCalls: 1, totalCalls: 2, coveragePercent: 50, unpricedCalls: 1, isMinimum: true,
  });
  assert.equal(snapshot.recentAnalyses[0].aiCost, 0.003);
  assert.equal(snapshot.recentAnalyses[0].aiCostComplete, false);
});

test("never turns absent subscription or AI evidence into a financial zero", () => {
  const snapshot = enrichDashboardSnapshot(base, {
    now: "2026-08-14T15:00:00.000Z", users: [], profiles: [], analyses: [], events: [], entitlements: [], purchases: [], telemetry: [],
  });

  assert.equal(snapshot.metrics.estimatedMrr, null);
  assert.equal(snapshot.metrics.freeToPaidRate, null);
  assert.equal(snapshot.metrics.aiCostMonth, null);
  assert.equal(snapshot.accuracy.revenue.status, "unavailable");
  assert.equal(snapshot.accuracy.aiCost.status, "unavailable");
});
