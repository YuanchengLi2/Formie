export type DashboardMetricValue = number | null;

export type DashboardMetrics = {
  totalUsers: number;
  newUsersToday: number;
  newUsers7d: number;
  newUsers30d: number;
  dau: number;
  wau: number;
  analysesToday: number;
  analyses7d: number;
  totalAnalyses: number;
  secondAnalysisRate: number;
  payingSubscribers: number;
  freeToPaidRate: DashboardMetricValue;
  estimatedMrr: DashboardMetricValue;
  cancellations: number;
  aiCostMonth: DashboardMetricValue;
  analysisSuccessRate: number;
  helpfulRate: DashboardMetricValue;
  helpfulVotes: number;
  unhelpfulVotes: number;
};

export type FunnelStep = {
  key: string;
  label: string;
  users: number;
  conversionFromPrevious: number;
  conversionFromSignup: number;
};

export type RecentUser = {
  id: string;
  email: string;
  displayName: string | null;
  joinedAt: string;
  plan: string;
  analyses: number;
  lastActiveAt: string | null;
  source: string | null;
  status: string;
};

export type RecentAnalysis = {
  id: string;
  userEmail: string;
  exercise: string;
  status: string;
  createdAt: string;
  processingMs: number | null;
  aiCost: DashboardMetricValue;
  aiCostComplete: boolean;
  feedback: boolean | null;
};

export type AccuracyStatus = "exact" | "estimated" | "incomplete" | "unavailable";

export type DashboardAccuracy = {
  aiCost: {
    status: AccuracyStatus;
    pricedCalls: number;
    totalCalls: number;
    coveragePercent: DashboardMetricValue;
    unpricedCalls: number;
    isMinimum: boolean;
  };
  revenue: {
    status: AccuracyStatus;
    pricedSubscriptions: number;
    totalSubscriptions: number;
    coveragePercent: DashboardMetricValue;
  };
  funnel: {
    status: AccuracyStatus;
    observedSince: string;
    ordered: boolean;
  };
};

export type AdminDashboardSnapshot = {
  generatedAt: string;
  metrics: DashboardMetrics;
  funnel: FunnelStep[];
  recentUsers: RecentUser[];
  recentAnalyses: RecentAnalysis[];
  accuracy: DashboardAccuracy;
};

const metricKeys: Array<keyof DashboardMetrics> = [
  "totalUsers", "newUsersToday", "newUsers7d", "newUsers30d", "dau", "wau",
  "analysesToday", "analyses7d", "totalAnalyses", "secondAnalysisRate", "payingSubscribers",
  "freeToPaidRate", "estimatedMrr", "cancellations", "aiCostMonth", "analysisSuccessRate",
  "helpfulRate", "helpfulVotes", "unhelpfulVotes",
];

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`Invalid ${label}`);
  return value as Record<string, unknown>;
}

function numberValue(value: unknown, label: string, nullable = false): number | null {
  if (nullable && value === null) return null;
  const parsed = typeof value === "number" ? value : typeof value === "string" && value.trim() !== "" ? Number(value) : Number.NaN;
  if (!Number.isFinite(parsed)) throw new Error(`Invalid ${label}`);
  return parsed;
}

function statusValue(value: unknown, label: string): AccuracyStatus {
  if (value === "exact" || value === "estimated" || value === "incomplete" || value === "unavailable") return value;
  throw new Error(`Invalid ${label}`);
}

export function parseDashboardSnapshot(input: unknown): AdminDashboardSnapshot {
  const root = record(input, "dashboard snapshot");
  if (typeof root.generatedAt !== "string" || Number.isNaN(Date.parse(root.generatedAt))) throw new Error("Invalid generatedAt");
  const rawMetrics = record(root.metrics, "metrics");
  const metrics = {} as DashboardMetrics;
  for (const key of metricKeys) {
    metrics[key] = numberValue(rawMetrics[key], key, key === "helpfulRate" || key === "freeToPaidRate" || key === "estimatedMrr" || key === "aiCostMonth") as never;
  }
  if (!Array.isArray(root.funnel) || !Array.isArray(root.recentUsers) || !Array.isArray(root.recentAnalyses)) {
    throw new Error("Invalid dashboard collections");
  }

  const funnel = root.funnel.map((item, index) => {
    const row = record(item, `funnel[${index}]`);
    if (typeof row.key !== "string" || typeof row.label !== "string") throw new Error(`Invalid funnel[${index}]`);
    return {
      key: row.key,
      label: row.label,
      users: numberValue(row.users, "users") as number,
      conversionFromPrevious: numberValue(row.conversionFromPrevious, "conversionFromPrevious") as number,
      conversionFromSignup: numberValue(row.conversionFromSignup, "conversionFromSignup") as number,
    };
  });

  const rawAccuracy = record(root.accuracy, "accuracy");
  const rawAiCost = record(rawAccuracy.aiCost, "accuracy.aiCost");
  const rawRevenue = record(rawAccuracy.revenue, "accuracy.revenue");
  const rawFunnel = record(rawAccuracy.funnel, "accuracy.funnel");
  if (typeof rawAiCost.isMinimum !== "boolean") throw new Error("Invalid accuracy.aiCost.isMinimum");
  if (typeof rawFunnel.ordered !== "boolean" || typeof rawFunnel.observedSince !== "string" || Number.isNaN(Date.parse(rawFunnel.observedSince))) {
    throw new Error("Invalid accuracy.funnel");
  }

  const accuracy: DashboardAccuracy = {
    aiCost: {
      status: statusValue(rawAiCost.status, "accuracy.aiCost.status"),
      pricedCalls: numberValue(rawAiCost.pricedCalls, "accuracy.aiCost.pricedCalls") as number,
      totalCalls: numberValue(rawAiCost.totalCalls, "accuracy.aiCost.totalCalls") as number,
      coveragePercent: numberValue(rawAiCost.coveragePercent, "accuracy.aiCost.coveragePercent", true),
      unpricedCalls: numberValue(rawAiCost.unpricedCalls, "accuracy.aiCost.unpricedCalls") as number,
      isMinimum: rawAiCost.isMinimum,
    },
    revenue: {
      status: statusValue(rawRevenue.status, "accuracy.revenue.status"),
      pricedSubscriptions: numberValue(rawRevenue.pricedSubscriptions, "accuracy.revenue.pricedSubscriptions") as number,
      totalSubscriptions: numberValue(rawRevenue.totalSubscriptions, "accuracy.revenue.totalSubscriptions") as number,
      coveragePercent: numberValue(rawRevenue.coveragePercent, "accuracy.revenue.coveragePercent", true),
    },
    funnel: {
      status: statusValue(rawFunnel.status, "accuracy.funnel.status"),
      observedSince: rawFunnel.observedSince,
      ordered: rawFunnel.ordered,
    },
  };

  return {
    generatedAt: root.generatedAt,
    metrics,
    funnel,
    recentUsers: root.recentUsers as RecentUser[],
    recentAnalyses: root.recentAnalyses as RecentAnalysis[],
    accuracy,
  };
}
