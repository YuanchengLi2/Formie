import { parseMetric, type Metric } from "@/lib/reporting/contracts";
import { requireCreator } from "./access";

export type CreatorEarningsBalance = { currency: string; pending: number; payable: number; paid: number; adjustments: number };
export type CreatorReferral = { id: string; signedUpAt: string; paidAt: string | null; commissionStatus: string | null; commissionAmount: number | null; commissionCurrency: string | null };
export type CreatorPayout = { id: string; currency: string; amount: number; status: string; preparedAt: string; paidAt: string | null };
export type CreatorDashboardData = {
  generatedAt: string;
  window: string;
  rangeStart: string | null;
  rangeEnd: string;
  creator: { displayName: string; status: string; creatorCode: string; rateBasisPoints: number };
  metrics: Record<string, Metric>;
  earningsByCurrency: CreatorEarningsBalance[];
  referrals: CreatorReferral[];
  referralPagination: { total: number; limit: number; offset: number; hasMore: boolean };
  payouts: CreatorPayout[];
};

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Creator reporting response is invalid");
  return value as Record<string, unknown>;
}

function finite(value: unknown, label: string): number {
  if ((typeof value !== "number" && typeof value !== "string") || (typeof value === "string" && !value.trim())) {
    throw new Error(`Creator reporting ${label} is invalid`);
  }
  const number = Number(value);
  if (!Number.isFinite(number)) throw new Error(`Creator reporting ${label} is invalid`);
  return number;
}

function optionalString(value: unknown): string | null {
  return typeof value === "string" && value ? value : null;
}

export function parseCreatorDashboard(value: unknown): CreatorDashboardData {
  const row = record(value);
  const creator = record(row.creator);
  const pagination = record(row.referralPagination);
  const metrics = Object.fromEntries(Object.entries(record(row.metrics)).map(([key, metric]) => [key, parseMetric(metric)]));
  for (const key of ["visits", "recovered", "accounts", "paid", "paidConversion", "bonusRecipients"]) {
    if (!metrics[key]) throw new Error(`Creator reporting metric ${key} is missing`);
  }
  const legacyUrl = typeof creator.referralUrl === "string" ? creator.referralUrl : "";
  const creatorCode = (typeof creator.creatorCode === "string" ? creator.creatorCode : legacyUrl.split("/").filter(Boolean).at(-1) ?? "").toUpperCase();
  if (typeof row.generatedAt !== "string" || typeof row.window !== "string" || typeof creator.displayName !== "string" || typeof creator.status !== "string" || !/^[A-Z0-9][A-Z0-9-]{2,31}$/.test(creatorCode)) throw new Error("Creator reporting response is invalid");
  const earningsByCurrency = Array.isArray(row.earningsByCurrency) ? row.earningsByCurrency.map((value) => {
    const item = record(value);
    if (typeof item.currency !== "string") throw new Error("Creator earnings currency is invalid");
    return { currency: item.currency, pending: finite(item.pending, "pending earnings"), payable: finite(item.payable, "payable earnings"), paid: finite(item.paid, "paid earnings"), adjustments: finite(item.adjustments, "earnings adjustments") };
  }) : [];
  const referrals = Array.isArray(row.referrals) ? row.referrals.map((value) => {
    const item = record(value);
    if (typeof item.id !== "string" || typeof item.signedUpAt !== "string") throw new Error("Creator referral row is invalid");
    return { id: item.id, signedUpAt: item.signedUpAt, paidAt: optionalString(item.paidAt), commissionStatus: optionalString(item.commissionStatus), commissionAmount: item.commissionAmount == null ? null : finite(item.commissionAmount, "commission amount"), commissionCurrency: optionalString(item.commissionCurrency) };
  }) : [];
  const payouts = Array.isArray(row.payouts) ? row.payouts.map((value) => {
    const item = record(value);
    if (typeof item.id !== "string" || typeof item.currency !== "string" || typeof item.status !== "string" || typeof item.preparedAt !== "string") throw new Error("Creator payout row is invalid");
    return { id: item.id, currency: item.currency, amount: finite(item.amount, "payout amount"), status: item.status, preparedAt: item.preparedAt, paidAt: optionalString(item.paidAt) };
  }) : [];
  return {
    generatedAt: row.generatedAt,
    window: row.window,
    rangeStart: optionalString(row.rangeStart),
    rangeEnd: typeof row.rangeEnd === "string" ? row.rangeEnd : row.generatedAt,
    creator: { displayName: creator.displayName, status: creator.status, creatorCode, rateBasisPoints: finite(creator.rateBasisPoints, "rate") },
    metrics,
    earningsByCurrency,
    referrals,
    referralPagination: { total: finite(pagination.total, "referral total"), limit: finite(pagination.limit, "referral limit"), offset: finite(pagination.offset, "referral offset"), hasMore: pagination.hasMore === true },
    payouts,
  };
}

export async function loadCreatorDashboard(window = "30d", page = 1, pageSize = 50, start: string | null = null, end: string | null = null): Promise<CreatorDashboardData> {
  const { client } = await requireCreator();
  const allowed = new Set(["24h", "7d", "30d", "90d", "all", "custom"]);
  const safePage = Number.isInteger(page) ? Math.min(Math.max(page, 1), 2001) : 1;
  const safePageSize = Number.isInteger(pageSize) ? Math.min(Math.max(pageSize, 1), 100) : 50;
  const safeWindow = allowed.has(window) ? window : "30d";
  const { data, error } = await client.rpc("get_creator_dashboard_v5", { p_window: safeWindow, p_start: safeWindow === "custom" ? start : null, p_end: safeWindow === "custom" ? end : null, p_limit: safePageSize, p_offset: (safePage - 1) * safePageSize });
  if (error) throw error;
  return parseCreatorDashboard(data);
}
