import { formatQuotaMessage } from "./quota-message";

describe("formatQuotaMessage", () => {
  it("explains the monthly limit and reset date without mentioning Pricing", () => {
    const message = formatQuotaMessage({ limit: 10, resetsAt: "2026-09-01T00:00:00.000Z", locale: "en-US", timeZone: "UTC" });
    expect(message).toMatch(/10 analyses/i);
    expect(message).toMatch(/September 1/i);
    expect(message).not.toMatch(/pricing|subscribe/i);
  });

  it("uses a useful fallback when no reset date is available", () => {
    expect(formatQuotaMessage({ limit: 10, resetsAt: null })).toMatch(/next monthly period/i);
  });
});
