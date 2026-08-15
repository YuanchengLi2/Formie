import type { AdminDashboardSnapshot, FunnelStep, RecentAnalysis } from "./dashboard-data";

const FUNNEL_OBSERVED_SINCE = "2026-08-04T00:00:00.000Z";

type BaseSnapshot = Omit<AdminDashboardSnapshot, "accuracy" | "recentAnalyses"> & {
  accuracy?: AdminDashboardSnapshot["accuracy"];
  recentAnalyses: Array<Omit<RecentAnalysis, "aiCostComplete"> & { aiCostComplete?: boolean }>;
};
type MaybeDate = string | null;

export type AccuracyInput = {
  now: string;
  users: Array<{ id: string; createdAt: string }>;
  profiles: Array<{ userId: string; onboardingCompletedAt: MaybeDate }>;
  analyses: Array<{ id: string; userId: string; status: string; createdAt: string; completedAt: MaybeDate }>;
  events: Array<{ userId: string | null; eventName: string; createdAt: string }>;
  entitlements: Array<{
    userId: string; status: string; sandbox: boolean; entitlementId: string | null; storeProductId: string | null;
    revenuecatAppUserId: string | null; lifecycleState: string | null; billingPeriodEnd: MaybeDate; currentPeriodEnd: MaybeDate;
  }>;
  purchases: Array<{
    appUserId: string; eventType: string; status: string; environment: string | null;
    purchasedAt: MaybeDate; eventTimestamp: MaybeDate; completedAt: MaybeDate; receivedAt: string;
  }>;
  telemetry: Array<{
    sessionId: string; model: string; createdAt: string; promptTokens: number | null; outputTokens: number | null;
    thinkingTokens: number | null; estimatedCostUsd: number | null;
  }>;
};

type PricedCall = AccuracyInput["telemetry"][number] & { cost: number | null };

function timestamp(value: MaybeDate): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function round(value: number, places: number): number {
  const factor = 10 ** places;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function percent(value: number, total: number): number | null {
  return total > 0 ? round(100 * value / total, 1) : null;
}

function modelRate(model: string, createdAt: string): { input: number; output: number } | null {
  const at = Date.parse(createdAt);
  if (model === "gemini-3.1-flash-lite" && at >= Date.parse("2026-03-01T00:00:00Z")) return { input: 0.25, output: 1.5 };
  if (model === "gemini-3.6-flash" && at >= Date.parse("2026-07-01T00:00:00Z")) return { input: 1.5, output: 7.5 };
  if (model === "gemini-3.7-flash" && at >= Date.parse("2026-08-13T00:00:00Z")) {
    return at < Date.parse("2027-01-01T00:00:00Z") ? { input: 0.75, output: 3.75 } : { input: 1.5, output: 7.5 };
  }
  return null;
}

function priceCall(call: AccuracyInput["telemetry"][number]): PricedCall {
  if (call.estimatedCostUsd !== null && Number.isFinite(call.estimatedCostUsd)) return { ...call, cost: call.estimatedCostUsd };
  const rate = modelRate(call.model, call.createdAt);
  if (!rate || call.promptTokens === null || call.outputTokens === null || call.thinkingTokens === null) return { ...call, cost: null };
  return {
    ...call,
    cost: (call.promptTokens * rate.input + (call.outputTokens + call.thinkingTokens) * rate.output) / 1_000_000,
  };
}

function funnelStep(key: string, label: string, users: number, previous: number, signup: number): FunnelStep {
  return {
    key,
    label,
    users,
    conversionFromPrevious: previous === 0 ? 0 : round(100 * users / previous, 1),
    conversionFromSignup: signup === 0 ? 0 : round(100 * users / signup, 1),
  };
}

export function enrichDashboardSnapshot(base: BaseSnapshot, input: AccuracyInput): AdminDashboardSnapshot {
  const now = Date.parse(input.now);
  const observedSince = Date.parse(FUNNEL_OBSERVED_SINCE);
  const delivered = input.analyses
    .filter((analysis) => analysis.status === "complete" || analysis.status === "partial")
    .map((analysis) => ({ ...analysis, deliveredAt: timestamp(analysis.completedAt) ?? Date.parse(analysis.createdAt) }));
  const analysesByUser = new Map<string, typeof delivered>();
  for (const analysis of delivered) {
    const rows = analysesByUser.get(analysis.userId) ?? [];
    rows.push(analysis);
    analysesByUser.set(analysis.userId, rows);
  }
  for (const rows of analysesByUser.values()) rows.sort((a, b) => a.deliveredAt - b.deliveredAt);

  const profileByUser = new Map(input.profiles.map((profile) => [profile.userId, profile]));
  const paywallsByUser = new Map<string, number[]>();
  for (const event of input.events) {
    if (!event.userId || event.eventName !== "paywall_viewed") continue;
    const rows = paywallsByUser.get(event.userId) ?? [];
    rows.push(Date.parse(event.createdAt));
    paywallsByUser.set(event.userId, rows);
  }

  const entitlementIdentities = new Map<string, string>();
  for (const entitlement of input.entitlements) {
    entitlementIdentities.set(entitlement.userId, entitlement.userId);
    if (entitlement.revenuecatAppUserId) entitlementIdentities.set(entitlement.revenuecatAppUserId, entitlement.userId);
  }
  const purchasesByUser = new Map<string, number[]>();
  for (const purchase of input.purchases) {
    if (purchase.status !== "completed" || purchase.environment?.toUpperCase() !== "PRODUCTION") continue;
    if (purchase.eventType !== "INITIAL_PURCHASE" && purchase.eventType !== "NON_RENEWING_PURCHASE") continue;
    const userId = entitlementIdentities.get(purchase.appUserId);
    const purchasedAt = timestamp(purchase.purchasedAt) ?? timestamp(purchase.eventTimestamp) ?? timestamp(purchase.completedAt) ?? timestamp(purchase.receivedAt);
    if (!userId || purchasedAt === null) continue;
    const rows = purchasesByUser.get(userId) ?? [];
    rows.push(purchasedAt);
    purchasesByUser.set(userId, rows);
  }

  let onboarding = 0;
  let firstAnalysis = 0;
  let paywall = 0;
  let purchase = 0;
  let subscriberReturn = 0;
  const cohort = input.users.filter((user) => Date.parse(user.createdAt) >= observedSince);
  for (const user of cohort) {
    const signupAt = Date.parse(user.createdAt);
    const onboardingAt = timestamp(profileByUser.get(user.id)?.onboardingCompletedAt ?? null);
    if (onboardingAt === null || onboardingAt < signupAt) continue;
    onboarding += 1;
    const firstAt = (analysesByUser.get(user.id) ?? []).find((analysis) => analysis.deliveredAt >= onboardingAt)?.deliveredAt ?? null;
    if (firstAt === null) continue;
    firstAnalysis += 1;
    const paywallAt = (paywallsByUser.get(user.id) ?? []).filter((at) => at >= firstAt).sort((a, b) => a - b)[0] ?? null;
    if (paywallAt === null) continue;
    paywall += 1;
    const purchaseAt = (purchasesByUser.get(user.id) ?? []).filter((at) => at >= paywallAt).sort((a, b) => a - b)[0] ?? null;
    if (purchaseAt === null) continue;
    purchase += 1;
    if ((analysesByUser.get(user.id) ?? []).some((analysis) => analysis.deliveredAt > purchaseAt)) subscriberReturn += 1;
  }

  const signup = cohort.length;
  const funnel = [
    funnelStep("signup", "Signed up", signup, signup, signup),
    funnelStep("onboarding", "Finished onboarding", onboarding, signup, signup),
    funnelStep("first_analysis", "First delivered analysis", firstAnalysis, onboarding, signup),
    funnelStep("paywall", "Viewed paywall after analysis", paywall, firstAnalysis, signup),
    funnelStep("purchase", "Verified production purchase", purchase, paywall, signup),
    funnelStep("subscriber_return", "Analyzed after purchase", subscriberReturn, purchase, signup),
  ];

  const activePaid = input.entitlements.filter((entitlement) => {
    const periodEnd = timestamp(entitlement.billingPeriodEnd) ?? timestamp(entitlement.currentPeriodEnd);
    return entitlement.status === "active" && !entitlement.sandbox && entitlement.entitlementId !== "legacy" && periodEnd !== null && periodEnd > now;
  });
  const monthlyRates = new Map<string, number>([["formie_monthly", 9.99], ["monthly", 9.99], ["formie_yearly", 99.99 / 12], ["yearly", 99.99 / 12]]);
  const pricedSubscriptions = activePaid.filter((entitlement) => entitlement.storeProductId && monthlyRates.has(entitlement.storeProductId));
  const grossRunRate = activePaid.length > 0 && pricedSubscriptions.length === activePaid.length
    ? round(pricedSubscriptions.reduce((sum, entitlement) => sum + monthlyRates.get(entitlement.storeProductId!)!, 0), 2)
    : null;

  const pricedCalls = input.telemetry.map(priceCall);
  const monthStart = new Date(now);
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const monthCalls = pricedCalls.filter((call) => Date.parse(call.createdAt) >= monthStart.getTime() && Date.parse(call.createdAt) <= now);
  const monthPriced = monthCalls.filter((call) => call.cost !== null);
  const monthCost = monthPriced.length > 0 ? round(monthPriced.reduce((sum, call) => sum + call.cost!, 0), 6) : null;

  const callsBySession = new Map<string, PricedCall[]>();
  for (const call of pricedCalls) {
    const rows = callsBySession.get(call.sessionId) ?? [];
    rows.push(call);
    callsBySession.set(call.sessionId, rows);
  }
  const recentAnalyses = base.recentAnalyses.map((analysis) => {
    const calls = callsBySession.get(analysis.id) ?? [];
    const priced = calls.filter((call) => call.cost !== null);
    return {
      ...analysis,
      aiCost: priced.length > 0 ? round(priced.reduce((sum, call) => sum + call.cost!, 0), 6) : null,
      aiCostComplete: calls.length > 0 && priced.length === calls.length,
    };
  });

  const usersWithAnalysis = [...analysesByUser.values()];
  const repeatUsers = usersWithAnalysis.filter((rows) => rows.length >= 2).length;
  const cancellations = input.entitlements.filter((entitlement) => entitlement.status === "active" && !entitlement.sandbox && entitlement.lifecycleState === "active_cancelled").length;

  return {
    generatedAt: input.now,
    metrics: {
      ...base.metrics,
      totalUsers: input.users.length,
      secondAnalysisRate: percent(repeatUsers, usersWithAnalysis.length) ?? 0,
      payingSubscribers: activePaid.length,
      freeToPaidRate: percent(purchase, firstAnalysis),
      estimatedMrr: grossRunRate,
      cancellations,
      aiCostMonth: monthCost,
    },
    funnel,
    recentUsers: base.recentUsers,
    recentAnalyses,
    accuracy: {
      aiCost: {
        status: monthCalls.length === 0 ? "unavailable" : monthPriced.length === monthCalls.length ? "estimated" : "incomplete",
        pricedCalls: monthPriced.length,
        totalCalls: monthCalls.length,
        coveragePercent: percent(monthPriced.length, monthCalls.length),
        unpricedCalls: monthCalls.length - monthPriced.length,
        isMinimum: monthPriced.length < monthCalls.length,
      },
      revenue: {
        status: activePaid.length === 0 ? "unavailable" : pricedSubscriptions.length === activePaid.length ? "estimated" : "incomplete",
        pricedSubscriptions: pricedSubscriptions.length,
        totalSubscriptions: activePaid.length,
        coveragePercent: percent(pricedSubscriptions.length, activePaid.length),
      },
      funnel: { status: "exact", observedSince: FUNNEL_OBSERVED_SINCE, ordered: true },
    },
  };
}
