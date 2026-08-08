import { formatQuotaMessage, formatQuotaTitle } from "./quota-message";

describe("formatQuotaMessage", () => {
  it("uses an access-ending title for a canceled subscription", () => {
    expect(formatQuotaTitle("active_cancelled", "2026-09-01T08:56:00Z", "en-US", "UTC")).toMatch(/access ends September 1, 2026 at 8:56 AM UTC/i);
    expect(formatQuotaTitle("active_renewing", "2026-09-01T08:56:00Z", "en-US", "UTC")).toBe("Monthly analyses used");
  });

  it("explains the monthly limit and reset date without mentioning Pricing", () => {
    const message = formatQuotaMessage({ lifecycleState: "active_renewing", limit: 10, resetsAt: "2026-09-01T08:56:00.000Z", paidThrough: "2026-09-01T08:56:00.000Z", locale: "en-US", timeZone: "UTC" });
    expect(message).toMatch(/10 analyses/i);
    expect(message).toMatch(/September 1, 2026 at 8:56 AM UTC/i);
    expect(message).not.toMatch(/pricing|subscribe/i);
  });

  it("uses a useful fallback when no reset date is available", () => {
    expect(formatQuotaMessage({ lifecycleState: "active_renewing", limit: 10, resetsAt: null, paidThrough: null })).toMatch(/next monthly period/i);
  });

  it("uses the access-end time for a cancelled exhausted account and never promises a reset", () => {
    const message = formatQuotaMessage({ lifecycleState: "active_cancelled", limit: 10, resetsAt: "2026-09-01T08:56:00Z", paidThrough: "2026-09-01T08:56:00Z", locale: "en-US", timeZone: "UTC" });
    expect(message).toMatch(/access ends September 1, 2026 at 8:56 AM UTC/i);
    expect(message).toMatch(/resuming renewal does not refill/i);
    expect(message).not.toMatch(/reset/i);
  });
});
