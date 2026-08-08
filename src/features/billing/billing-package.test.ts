import type { BillingPackage } from "./types";
import { selectBillingPlans, selectMonthlyPackage } from "./billing-package";

const annualPackage: BillingPackage = {
  identifier: "$rc_annual",
  productIdentifier: "formie_yearly",
  priceString: "$99.99",
  title: "Formie Annual",
};

const monthlyPackage: BillingPackage = {
  identifier: "$rc_monthly",
  productIdentifier: "formie_monthly",
  priceString: "$9.99",
  title: "Formie Monthly",
};

describe("monthly RevenueCat package selection", () => {
  it("selects the configured monthly product even when it is not first", () => {
    expect(selectMonthlyPackage([annualPackage, monthlyPackage])).toEqual(monthlyPackage);
  });

  it("returns null instead of silently selecting another subscription", () => {
    expect(selectMonthlyPackage([annualPackage])).toBeNull();
  });
});

describe("monthly and annual RevenueCat plan selection", () => {
  it("returns both configured packages without depending on offering order", () => {
    expect(selectBillingPlans([annualPackage, monthlyPackage])).toEqual({ monthly: monthlyPackage, annual: annualPackage });
  });

  it("accepts the existing Test Store yearly alias", () => {
    expect(selectBillingPlans([{ ...annualPackage, productIdentifier: "yearly" }, monthlyPackage]).annual?.productIdentifier).toBe("yearly");
  });
});
