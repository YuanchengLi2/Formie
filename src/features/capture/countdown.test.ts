import { countdownSequence, formatElapsed, normalizeRecordedDuration } from "./countdown";

describe("capture countdown", () => {
  it("counts from the requested delay through zero", () => {
    expect(countdownSequence(10)).toEqual([10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0]);
  });

  it("formats the recording timer with tabular minutes and seconds", () => {
    expect(formatElapsed(0)).toBe("00:00");
    expect(formatElapsed(61_000)).toBe("01:01");
  });

  it("preserves camera finalization duration so over-limit recordings can be rejected", () => {
    expect(normalizeRecordedDuration(15_127)).toBe(15_127);
    expect(normalizeRecordedDuration(10_127)).toBe(10_127);
    expect(normalizeRecordedDuration(2_999)).toBe(2_999);
  });
});
