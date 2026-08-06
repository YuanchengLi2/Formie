import type { CustomerInfo, Package, Purchases } from "@revenuecat/purchases-js";

import { assertRevenueCatPublicKey, REVENUECAT_ENTITLEMENT_ID, REVENUECAT_WEB_PUBLIC_KEY } from "./constants";
import { subscriptionFromEntitlement } from "./purchase-access";
import type { BillingCustomerInfo, BillingOffering, BillingPackage, PurchasesClient } from "./types";

type RevenueCatModule = typeof import("@revenuecat/purchases-js");

let sdkModulePromise: Promise<RevenueCatModule> | null = null;
let purchases: Purchases | null = null;
let configuredUserId: string | null = null;
let configurePromise: Promise<void> | null = null;
let currentPackages: Package[] = [];

async function loadSdk(): Promise<RevenueCatModule> {
  sdkModulePromise ??= import("@revenuecat/purchases-js");
  return sdkModulePromise;
}

function mapCustomerInfo(info: CustomerInfo): BillingCustomerInfo {
  const entitlement = info.entitlements.all[REVENUECAT_ENTITLEMENT_ID] ?? null;
  return {
    activeEntitlementIds: Object.values(info.entitlements.active).map((entitlement) => entitlement.identifier),
    originalAppUserId: info.originalAppUserId ?? null,
    subscription: entitlement ? subscriptionFromEntitlement(entitlement, info.managementURL) : null,
  };
}

function mapOffering(current: Awaited<ReturnType<Purchases["getOfferings"]>>["current"]): BillingOffering | null {
  if (!current) return null;
  currentPackages = current.availablePackages;
  const packages: BillingPackage[] = current.availablePackages.map((item) => ({
    identifier: item.identifier,
    productIdentifier: item.webBillingProduct.identifier,
    priceString: item.webBillingProduct.price.formattedPrice,
    title: item.webBillingProduct.title,
  }));
  return { identifier: current.identifier, packages };
}

async function ensureConfigured(appUserId?: string | null): Promise<void> {
  if (configurePromise) await configurePromise;
  if (!REVENUECAT_WEB_PUBLIC_KEY) throw new Error("RevenueCat is not configured for web yet.");
  assertRevenueCatPublicKey(REVENUECAT_WEB_PUBLIC_KEY, !__DEV__);

  const sdk = await loadSdk();
  // Calls made by getOfferings/getCustomerInfo must keep the user selected by
  // configure(). Only an explicit null from the auth layer starts an anonymous
  // session; otherwise an authenticated purchase could silently move to a new
  // anonymous RevenueCat customer before the receipt is posted.
  const nextUserId = appUserId === undefined
    ? configuredUserId ?? sdk.Purchases.generateRevenueCatAnonymousAppUserId()
    : appUserId ?? sdk.Purchases.generateRevenueCatAnonymousAppUserId();
  if (purchases && sdk.Purchases.isConfigured()) {
    if (configuredUserId !== nextUserId) {
      configurePromise = purchases.changeUser(nextUserId).then(() => undefined);
      try {
        await configurePromise;
      } finally {
        configurePromise = null;
      }
    }
    configuredUserId = nextUserId;
    return;
  }

  configurePromise = Promise.resolve().then(() => {
    purchases = sdk.Purchases.configure({ apiKey: REVENUECAT_WEB_PUBLIC_KEY, appUserId: nextUserId });
    configuredUserId = nextUserId;
    currentPackages = [];
  });
  try {
    await configurePromise;
  } finally {
    configurePromise = null;
  }
}

async function getPurchases(): Promise<Purchases> {
  await ensureConfigured();
  if (!purchases) throw new Error("RevenueCat could not be initialized.");
  return purchases;
}

export const purchasesClient: PurchasesClient = {
  async configure(appUserId = null) {
    await ensureConfigured(appUserId);
  },
  async logOut() {
    if (purchases) purchases.close();
    purchases = null;
    configuredUserId = null;
    currentPackages = [];
  },
  async getOfferings() {
    const client = await getPurchases();
    return mapOffering((await client.getOfferings()).current);
  },
  async getCustomerInfo() {
    return mapCustomerInfo(await (await getPurchases()).getCustomerInfo());
  },
  async purchasePackage(packageIdentifier) {
    const client = await getPurchases();
    const item = currentPackages.find((candidate) => candidate.identifier === packageIdentifier)
      ?? (await client.getOfferings()).current?.availablePackages.find((candidate) => candidate.identifier === packageIdentifier);
    if (!item) throw new Error("The Formie monthly product is unavailable right now.");
    const result = await client.purchase({ rcPackage: item, skipSuccessPage: true });
    return { customerInfo: mapCustomerInfo(result.customerInfo), productIdentifier: item.webBillingProduct.identifier };
  },
  async restorePurchases() {
    // Web Billing has no separate restore endpoint. CustomerInfo is the source of truth
    // for the current RevenueCat user, so fetching it restores an existing sandbox purchase.
    return mapCustomerInfo(await (await getPurchases()).getCustomerInfo());
  },
  subscribeCustomerInfo() {
    return () => undefined;
  },
};
