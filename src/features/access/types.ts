export type AccessState = "loading" | "active" | "expired" | "unknown";

export type AccessStatus = {
  status: Exclude<AccessState, "loading" | "unknown"> | "unknown";
  canAnalyze: boolean;
  quotaUsed: number | null;
  quotaLimit: number | null;
  remaining: number | null;
  periodStartsAt: string | null;
  periodEndsAt: string | null;
  entitlementId: string | null;
  source: "revenuecat" | "unknown";
  refreshedAt: string;
};

export const unknownAccess: AccessStatus = {
  status: "unknown",
  canAnalyze: false,
  quotaUsed: null,
  quotaLimit: null,
  remaining: null,
  periodStartsAt: null,
  periodEndsAt: null,
  entitlementId: null,
  source: "unknown",
  refreshedAt: "",
};

export type AnalysisReservation = {
  reservationId: string;
  status: "reserved" | "already_reserved";
  remaining: number | null;
  periodEndsAt: string | null;
};
