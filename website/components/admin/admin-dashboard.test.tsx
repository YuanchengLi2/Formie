import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import { AdminDashboard } from "./admin-dashboard";

const snapshot = {
  generatedAt: "2026-08-14T12:00:00.000Z",
  metrics: {
    totalUsers: 42, newUsersToday: 3, newUsers7d: 11, newUsers30d: 29, dau: 8, wau: 23,
    analysesToday: 6, analyses7d: 31, totalAnalyses: 77, secondAnalysisRate: 38.5,
    payingSubscribers: 9, freeToPaidRate: 12.5, estimatedMrr: 89.91, cancellations: 2,
    aiCostMonth: 14.2841, analysisSuccessRate: 96.7, helpfulRate: null, helpfulVotes: 0, unhelpfulVotes: 0,
  },
  funnel: [
    { key: "signup", label: "Signed up", users: 42, conversionFromPrevious: 100, conversionFromSignup: 100 },
    { key: "first_analysis", label: "First analysis", users: 20, conversionFromPrevious: 47.6, conversionFromSignup: 47.6 },
    { key: "purchase", label: "Purchased", users: 9, conversionFromPrevious: 45, conversionFromSignup: 21.4 },
    { key: "second_analysis", label: "Second analysis", users: 7, conversionFromPrevious: 77.8, conversionFromSignup: 16.7 },
  ],
  recentUsers: [{ id: "u1", email: "member@example.com", displayName: "Member", joinedAt: "2026-08-14T10:00:00Z", plan: "Pro monthly", analyses: 2, lastActiveAt: "2026-08-14T11:00:00Z", source: "TikTok", status: "Active" }],
  recentAnalyses: [{ id: "a1", userEmail: "member@example.com", exercise: "Back Squat", status: "Complete", createdAt: "2026-08-14T11:00:00Z", processingMs: 42000, aiCost: 0.0831, feedback: null }],
};

test("renders the founder metrics, funnel, and operational tables", () => {
  const html = renderToStaticMarkup(<AdminDashboard snapshot={snapshot} adminEmail="yuanchengli612@gmail.com" />);

  for (const text of ["Second analysis rate", "Estimated MRR", "Analysis success", "Advice rating", "Recent users", "Recent analyses", "Signed up", "Purchased"]) {
    assert.match(html, new RegExp(text, "i"));
  }
  assert.match(html, /No ratings yet/i);
  assert.match(html, /member@example\.com/i);
  assert.match(html, /Monthly production subscriptions only/i);
});
