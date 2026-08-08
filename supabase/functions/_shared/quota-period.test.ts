import { resolveQuotaPeriod } from "./quota-period";

describe("resolveQuotaPeriod", () => {
  it("uses the billing period for monthly plans", () => {
    expect(resolveQuotaPeriod({
      planCode: "monthly",
      billingPeriodStart: "2026-08-01T00:00:00.000Z",
      billingPeriodEnd: "2026-09-01T00:00:00.000Z",
      sandbox: false,
      store: "app_store",
    }, new Date("2026-08-15T00:00:00.000Z"))).toEqual({
      startsAt: "2026-08-01T00:00:00.000Z",
      endsAt: "2026-09-01T00:00:00.000Z",
    });
  });

  it("keeps annual quota anchored to the purchase day without end-of-month drift", () => {
    const input = {
      planCode: "annual" as const,
      billingPeriodStart: "2026-01-31T12:00:00.000Z",
      billingPeriodEnd: "2027-01-31T12:00:00.000Z",
      sandbox: false,
      store: "app_store",
    };
    expect(resolveQuotaPeriod(input, new Date("2026-02-15T00:00:00.000Z"))).toEqual({
      startsAt: "2026-01-31T12:00:00.000Z",
      endsAt: "2026-02-28T12:00:00.000Z",
    });
    expect(resolveQuotaPeriod(input, new Date("2026-03-15T00:00:00.000Z"))).toEqual({
      startsAt: "2026-02-28T12:00:00.000Z",
      endsAt: "2026-03-31T12:00:00.000Z",
    });
  });

  it("uses five-minute annual quota windows in RevenueCat Test Store", () => {
    expect(resolveQuotaPeriod({
      planCode: "annual",
      billingPeriodStart: "2026-08-06T23:00:00.000Z",
      billingPeriodEnd: "2026-08-07T00:00:00.000Z",
      sandbox: true,
      store: "test_store",
    }, new Date("2026-08-06T23:12:00.000Z"))).toEqual({
      startsAt: "2026-08-06T23:10:00.000Z",
      endsAt: "2026-08-06T23:15:00.000Z",
    });
  });
});
