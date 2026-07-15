import { countdownSequence, formatElapsed } from "./countdown";

describe("capture countdown", () => {
  it("counts from the requested delay through zero", () => {
    expect(countdownSequence(10)).toEqual([10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0]);
  });

  it("formats the recording timer with tabular minutes and seconds", () => {
    expect(formatElapsed(0)).toBe("00:00");
    expect(formatElapsed(61_000)).toBe("01:01");
  });
});
