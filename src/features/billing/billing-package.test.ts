import type { BillingPackage } from "./types";
import { selectMonthlyPackage } from "./billing-package";

const annualPackage: BillingPackage = {
  identifier: "$rc_annual",
  productIdentifier: "formie_annual",
  priceString: "$89.99",
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
