import { REVENUECAT_PRODUCT_ID } from "./constants";
import type { BillingPackage } from "./types";

export function selectMonthlyPackage(packages: BillingPackage[]): BillingPackage | null {
  return packages.find((item) => item.productIdentifier === REVENUECAT_PRODUCT_ID || item.identifier === "$rc_monthly") ?? null;
}
