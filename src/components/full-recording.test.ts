import { timelineMarkerPercent } from "./full-recording";

describe("full recording timeline", () => {
  it("positions rep markers against the complete recording duration", () => {
    expect(timelineMarkerPercent(5_000, 20_000)).toBe(25);
    expect(timelineMarkerPercent(19_900, 20_000)).toBe(98);
  });
});
