import { AnalysisDeadline } from "./analysis-deadline";

describe("analysis deadline", () => {
  it("reserves bounded time for each coaching-writer attempt", () => {
    const deadline = new AnalysisDeadline(1_000);
    expect(deadline.timeoutFor("finalizing", 2_000)).toBe(30_000);
    expect(deadline.timeoutFor("analyzing", 2_000)).toBe(115_000);
  });
});
