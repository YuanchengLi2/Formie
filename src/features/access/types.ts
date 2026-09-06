export type AccessState = "loading" | "active" | "expired" | "unknown";
export type SubscriptionLifecycleState = "active_renewing" | "active_cancelled" | "renewal_pending" | "expired" | "not_subscribed" | "unknown";
export type SubscriptionPlanCode = "monthly" | "annual";
export type ReferralBonusAccess = {
  state: "none" | "pending_payment" | "active" | "expired" | "revoked";
  baseLimit: number;
  baseUsed: number;
  bonusGranted: number;
  bonusUsed: number;
  bonusReserved: number;
  bonusRemaining: number;
  bonusExpiresAt: string | null;
};

export const noReferralBonus: ReferralBonusAccess = { state: "none", baseLimit: 10, baseUsed: 0, bonusGranted: 0, bonusUsed: 0, bonusReserved: 0, bonusRemaining: 0, bonusExpiresAt: null };

export type AccessStatus = {
  status: Exclude<AccessState, "loading" | "unknown"> | "unknown";
  lifecycleState: SubscriptionLifecycleState;
  canAnalyze: boolean;
  quotaUsed: number | null;
  quotaLimit: number | null;
  remaining: number | null;
  periodStartsAt: string | null;
  periodEndsAt: string | null;
  quotaPeriodStartsAt: string | null;
  quotaResetsAt: string | null;
  billingPeriodStartsAt: string | null;
  paidThrough: string | null;
  productIdentifier: string | null;
  planCode: SubscriptionPlanCode | null;
  store: string | null;
  sandbox: boolean;
  willRenew: boolean;
  pendingAnalysisSessionId: string | null;
  stateVersion: number;
  entitlementId: string | null;
  source: "revenuecat" | "unknown";
  refreshedAt: string;
  referralBonus: ReferralBonusAccess;
};

export const unknownAccess: AccessStatus = {
  status: "unknown",
  lifecycleState: "unknown",
  canAnalyze: false,
  quotaUsed: null,
  quotaLimit: null,
  remaining: null,
  periodStartsAt: null,
  periodEndsAt: null,
  quotaPeriodStartsAt: null,
  quotaResetsAt: null,
  billingPeriodStartsAt: null,
  paidThrough: null,
  productIdentifier: null,
  planCode: null,
  store: null,
  sandbox: false,
  willRenew: false,
  pendingAnalysisSessionId: null,
  stateVersion: 0,
  entitlementId: null,
  source: "unknown",
  refreshedAt: "",
  referralBonus: noReferralBonus,
};

export type AnalysisReservation = {
  reservationId: string | null;
  status: "reserved" | "already_reserved" | "analysis_pending";
  remaining: number | null;
  periodEndsAt: string | null;
  blockingSessionId: string | null;
};
