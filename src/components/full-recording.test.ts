import { buildPlaybackCoachingMoments, formatPlaybackTime, isTimelineDrag, nextFrameIndex, reviewPurposeLabel, stepPlaybackMs, timelineMarkerPercent, timelineSeekFromPageX, timelineSeekMs } from "./full-recording";

describe("full recording timeline", () => {
  it("positions rep markers against the complete recording duration", () => {
    expect(timelineMarkerPercent(5_000, 20_000)).toBe(25);
    expect(timelineMarkerPercent(19_900, 20_000)).toBe(98);
  });

  it("maps a custom scrubber position to the recording time", () => {
    expect(timelineSeekMs(100, 400, 20_000)).toBe(5_000);
    expect(timelineSeekMs(500, 400, 20_000)).toBe(20_000);
    expect(formatPlaybackTime(65_400)).toBe("01:05");
    expect(timelineSeekFromPageX(375, 275, 400, 20_000)).toBe(5_000);
  });

  it("keeps taps local to the timeline and only captures deliberate drags", () => {
    expect(timelineSeekMs(75, 300, 60_000)).toBe(15_000);
    expect(isTimelineDrag(3, 4)).toBe(false);
    expect(isTimelineDrag(7, 1)).toBe(true);
    expect(isTimelineDrag(1, 8)).toBe(false);
  });

  it("plots every AI coaching moment, including multiple and between-rep evidence", () => {
    const moments = buildPlaybackCoachingMoments([{ id: "bar-path", coachingArea: "form", title: "Level the bar", detail: "The right side leads.", whyItMatters: "The press becomes uneven.", correction: "Press both sides together.", cue: "Level bar.", severity: "high", evidence: [
      { startMs: 1_000, peakMs: 1_250, endMs: 1_500, repNumber: 1, phase: "lowering", visualEvidence: "Right side leads.", visibleBodyAreas: ["bar"], confidence: 0.91, focusRegion: null },
      { startMs: 2_000, peakMs: 2_250, endMs: 2_500, repNumber: null, phase: "reset", visualEvidence: "Bar remains tilted between reps.", visibleBodyAreas: ["bar"], confidence: 0.87, focusRegion: null },
    ] }]);
    expect(moments.map((moment) => ({ timeMs: moment.timeMs, repNumber: moment.evidence.repNumber }))).toEqual([{ timeMs: 1_250, repNumber: 1 }, { timeMs: 2_250, repNumber: null }]);
  });

  it("supports accessible five-second timeline steps without passing the recording bounds", () => {
    expect(stepPlaybackMs(9_000, 20_000, 1)).toBe(14_000);
    expect(stepPlaybackMs(2_000, 20_000, -1)).toBe(0);
    expect(stepPlaybackMs(19_000, 20_000, 1)).toBe(20_000);
  });

  it("wraps review frames and labels their coaching purpose", () => {
    expect(nextFrameIndex(1, 3, 1)).toBe(2);
    expect(nextFrameIndex(2, 3, 1)).toBe(0);
    expect(nextFrameIndex(0, 3, -1)).toBe(2);
    expect(reviewPurposeLabel("next")).toBe("What to do next");
  });

});
