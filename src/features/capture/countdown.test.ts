import { countdownSequence, formatElapsed, normalizeRecordedDuration } from "./countdown";

describe("capture countdown", () => {
  it("counts from the requested delay through zero", () => {
    expect(countdownSequence(10)).toEqual([10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0]);
  });

  it("formats the recording timer with tabular minutes and seconds", () => {
    expect(formatElapsed(0)).toBe("00:00");
    expect(formatElapsed(61_000)).toBe("01:01");
  });

  it("caps camera finalization overhead without inflating short recordings", () => {
    expect(normalizeRecordedDuration(90_127)).toBe(90_000);
    expect(normalizeRecordedDuration(60_127)).toBe(60_127);
    expect(normalizeRecordedDuration(2_999)).toBe(2_999);
  });
});
