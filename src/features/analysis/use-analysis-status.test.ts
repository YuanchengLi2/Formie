import { analysisRefetchInterval } from "./analysis-polling";

describe("analysis retry polling", () => {
  it("stops polling terminal sessions", () => {
    expect(analysisRefetchInterval("complete", null, 1_000)).toBe(false);
    expect(analysisRefetchInterval("failed", null, 1_000)).toBe(false);
  });

  it("waits for the durable retry time instead of hammering the analyzer", () => {
    expect(analysisRefetchInterval("processing", "2026-08-02T20:00:10.000Z", Date.parse("2026-08-02T20:00:00.000Z"))).toBe(10_000);
  });

  it("keeps ordinary processing responsive and caps a long retry wait", () => {
    expect(analysisRefetchInterval("processing", null, 1_000)).toBe(750);
    expect(analysisRefetchInterval("processing", "2026-08-02T21:00:00.000Z", Date.parse("2026-08-02T20:00:00.000Z"))).toBe(30_000);
  });
});
