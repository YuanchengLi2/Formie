export type PurchaseState = "idle" | "loading" | "ready" | "purchasing" | "restoring" | "pending" | "cancelled" | "failed" | "succeeded";
export type EntitlementResolution = "idle" | "checking" | "active" | "expired" | "error";

export type BillingPackage = {
  identifier: string;
  productIdentifier: string;
  priceString: string;
  title: string;
};

export type BillingOffering = {
  identifier: string;
  packages: BillingPackage[];
};

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
  purchasePackage: (packageIdentifier: string) => Promise<PurchaseResult>;
  restorePurchases: () => Promise<BillingCustomerInfo>;
  subscribeCustomerInfo: (listener: (customerInfo: BillingCustomerInfo) => void) => () => void;
};
