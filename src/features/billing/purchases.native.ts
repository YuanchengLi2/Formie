import Purchases from "react-native-purchases";

import { assertRevenueCatPublicKey, REVENUECAT_ANDROID_PUBLIC_KEY, REVENUECAT_ENTITLEMENT_ID, REVENUECAT_IOS_PUBLIC_KEY } from "./constants";
import { subscriptionFromEntitlement } from "./purchase-access";
import type { BillingCustomerInfo, BillingOffering, BillingPackage, PurchasesClient } from "./types";

function mapCustomerInfo(info: Awaited<ReturnType<typeof Purchases.getCustomerInfo>>): BillingCustomerInfo {
  const entitlement = info.entitlements.all[REVENUECAT_ENTITLEMENT_ID] ?? null;
  return {
    activeEntitlementIds: Object.values(info.entitlements.active).map((entitlement) => entitlement.identifier),
    originalAppUserId: info.originalAppUserId ?? null,
    subscription: entitlement ? subscriptionFromEntitlement(entitlement, info.managementURL) : null,
  };
}

let configuredUserId: string | null = null;

export const purchasesClient: PurchasesClient = {
  async configure(appUserId = null) {
    const apiKey = process.env.EXPO_OS === "ios" ? REVENUECAT_IOS_PUBLIC_KEY : REVENUECAT_ANDROID_PUBLIC_KEY;
    if (!apiKey) throw new Error("RevenueCat is not configured for this platform yet.");
    assertRevenueCatPublicKey(apiKey, !__DEV__);
    const configured = await Purchases.isConfigured();
    if (!configured) Purchases.configure(appUserId ? { apiKey, appUserID: appUserId } : { apiKey });
    else if (appUserId && configuredUserId !== appUserId) await Purchases.logIn(appUserId);
    configuredUserId = appUserId;
  },
  async logOut() {
    if (await Purchases.isConfigured()) await Purchases.logOut();
    configuredUserId = null;
  },
  async getOfferings() {
    const offerings = await Purchases.getOfferings();
    const current = offerings.current;
    if (!current) return null;
    const packages: BillingPackage[] = current.availablePackages.map((item) => ({
      identifier: item.identifier,
      productIdentifier: item.product.identifier,
      priceString: item.product.priceString,
      title: item.product.title,
      priceAmount: item.product.price,
      currencyCode: item.product.currencyCode,
      billingPeriod: item.identifier === "$rc_annual" ? "year" : item.identifier === "$rc_monthly" ? "month" : null,
    }));
    return { identifier: current.identifier, packages } as BillingOffering;
  },
  async getCustomerInfo() {
    return mapCustomerInfo(await Purchases.getCustomerInfo());
  },
  async purchasePackage(packageIdentifier, options = {}) {
    const offerings = await Purchases.getOfferings();
    const item = offerings.current?.availablePackages.find((candidate) => candidate.identifier === packageIdentifier);
    if (!item) throw new Error("The Formie monthly product is unavailable right now.");
    const productChangeInfo = process.env.EXPO_OS === "android"
      && options.currentProductIdentifier
      && options.currentProductIdentifier !== item.product.identifier
      ? { oldProductIdentifier: options.currentProductIdentifier, replacementMode: Purchases.STORE_REPLACEMENT_MODE.CHARGE_FULL_PRICE }
      : null;
    const result = await Purchases.purchasePackage(item, null, productChangeInfo);
    return { customerInfo: mapCustomerInfo(result.customerInfo), productIdentifier: result.productIdentifier };
  },
  async restorePurchases() {
    return mapCustomerInfo(await Purchases.restorePurchases());
  },
  subscribeCustomerInfo(listener) {
    const nativeListener = (info: Awaited<ReturnType<typeof Purchases.getCustomerInfo>>) => listener(mapCustomerInfo(info));
    Purchases.addCustomerInfoUpdateListener(nativeListener);
    return () => Purchases.removeCustomerInfoUpdateListener(nativeListener);
  },
};
