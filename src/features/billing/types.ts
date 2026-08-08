export type PurchaseState = "idle" | "loading" | "ready" | "purchasing" | "reconciling" | "sync_required" | "restoring" | "cancelled" | "failed" | "succeeded";
export type PurchaseOutcome = "active" | "sync_required" | "cancelled" | "failed";
export type EntitlementResolution = "idle" | "checking" | "active" | "expired" | "error";
export type BillingPlanCode = "monthly" | "annual";

export type BillingPackage = {
  identifier: string;
  productIdentifier: string;
  priceString: string;
  title: string;
  priceAmount?: number | null;
  currencyCode?: string | null;
  billingPeriod?: "month" | "year" | null;
};

export type BillingOffering = {
  identifier: string;
  packages: BillingPackage[];
};

export type BillingPlans = Record<BillingPlanCode, BillingPackage | null>;

export type BillingCustomerInfo = {
  activeEntitlementIds: string[];
  originalAppUserId: string | null;
  subscription: BillingSubscription | null;
};

export type BillingSubscription = {
  entitlementId: string;
  productIdentifier: string;
  isActive: boolean;
  willRenew: boolean;
  expirationDate: string | null;
  managementURL: string | null;
  isSandbox: boolean;
  store: string;
};

export type PurchaseResult = {
  customerInfo: BillingCustomerInfo;
  productIdentifier: string;
};

export type PurchasesClient = {
  configure: (appUserId?: string | null) => Promise<void>;
  logOut: () => Promise<void>;
  getOfferings: () => Promise<BillingOffering | null>;
  getCustomerInfo: () => Promise<BillingCustomerInfo>;
  purchasePackage: (packageIdentifier: string, options?: { currentProductIdentifier?: string | null }) => Promise<PurchaseResult>;
  restorePurchases: () => Promise<BillingCustomerInfo>;
  subscribeCustomerInfo: (listener: (customerInfo: BillingCustomerInfo) => void) => () => void;
};
