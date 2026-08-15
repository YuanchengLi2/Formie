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
  freeToPaidRate: number;
  estimatedMrr: number;
  cancellations: number;
  aiCostMonth: number;
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
  aiCost: number;
  feedback: boolean | null;
};

export type AdminDashboardSnapshot = {
  generatedAt: string;
  metrics: DashboardMetrics;
  funnel: FunnelStep[];
  recentUsers: RecentUser[];
  recentAnalyses: RecentAnalysis[];
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

export function parseDashboardSnapshot(input: unknown): AdminDashboardSnapshot {
  const root = record(input, "dashboard snapshot");
  if (typeof root.generatedAt !== "string" || Number.isNaN(Date.parse(root.generatedAt))) throw new Error("Invalid generatedAt");
  const rawMetrics = record(root.metrics, "metrics");
  const metrics = {} as DashboardMetrics;
  for (const key of metricKeys) {
    metrics[key] = numberValue(rawMetrics[key], key, key === "helpfulRate") as never;
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

  return {
    generatedAt: root.generatedAt,
    metrics,
    funnel,
    recentUsers: root.recentUsers as RecentUser[],
    recentAnalyses: root.recentAnalyses as RecentAnalysis[],
  };
}
