import { REVENUECAT_MONTHLY_PRODUCT_ID, REVENUECAT_YEARLY_PRODUCT_ID } from "./constants";
import type { BillingPackage, BillingPlans } from "./types";

export function selectMonthlyPackage(packages: BillingPackage[]): BillingPackage | null {
  return packages.find((item) => item.productIdentifier === REVENUECAT_MONTHLY_PRODUCT_ID || item.identifier === "$rc_monthly") ?? null;
}

export function selectBillingPlans(packages: BillingPackage[]): BillingPlans {
  return {
    monthly: selectMonthlyPackage(packages),
    annual: packages.find((item) => item.productIdentifier === REVENUECAT_YEARLY_PRODUCT_ID || item.productIdentifier === "yearly" || item.identifier === "$rc_annual") ?? null,
  };
}
