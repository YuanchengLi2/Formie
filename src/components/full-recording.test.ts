import { buildPlaybackCoachingMoments, clampPlaybackZoom, focusPresentation, formatPlaybackTime, nextFrameIndex, pinchStartZoom, reviewPurposeLabel, timelineMarkerPercent, timelineSeekMs } from "./full-recording";

describe("full recording timeline", () => {
  it("positions rep markers against the complete recording duration", () => {
    expect(timelineMarkerPercent(5_000, 20_000)).toBe(25);
    expect(timelineMarkerPercent(19_900, 20_000)).toBe(98);
  });

  it("maps a custom scrubber position to the recording time", () => {
    expect(timelineSeekMs(100, 400, 20_000)).toBe(5_000);
    expect(timelineSeekMs(500, 400, 20_000)).toBe(20_000);
    expect(formatPlaybackTime(65_400)).toBe("01:05");
  });

  it("plots every AI coaching moment, including multiple and between-rep evidence", () => {
    const moments = buildPlaybackCoachingMoments([{ id: "bar-path", title: "Level the bar", detail: "The right side leads.", whyItMatters: "The press becomes uneven.", correction: "Press both sides together.", cue: "Level bar.", severity: "high", evidence: [
      { startMs: 1_000, peakMs: 1_250, endMs: 1_500, repNumber: 1, phase: "lowering", visualEvidence: "Right side leads.", visibleBodyAreas: ["bar"], confidence: 0.91, focusRegion: null },
      { startMs: 2_000, peakMs: 2_250, endMs: 2_500, repNumber: null, phase: "reset", visualEvidence: "Bar remains tilted between reps.", visibleBodyAreas: ["bar"], confidence: 0.87, focusRegion: null },
    ] }]);
    expect(moments.map((moment) => ({ timeMs: moment.timeMs, repNumber: moment.evidence.repNumber }))).toEqual([{ timeMs: 1_250, repNumber: 1 }, { timeMs: 2_250, repNumber: null }]);
  });

  it("keeps pinch zoom in the supported range", () => {
    expect(clampPlaybackZoom(0.4)).toBe(1);
    expect(clampPlaybackZoom(1.8)).toBe(1.8);
    expect(clampPlaybackZoom(4)).toBe(2.5);
  });

  it("starts an inward pinch from the visible AI zoom so dezoom returns smoothly to full frame", () => {
    expect(pinchStartZoom("auto", 1)).toBe(1.7);
    expect(pinchStartZoom("manual", 2.2)).toBe(2.2);
    expect(pinchStartZoom("full", 2.2)).toBe(1);
  });

  it("wraps review frames and labels their coaching purpose", () => {
    expect(nextFrameIndex(1, 3, 1)).toBe(2);
    expect(nextFrameIndex(2, 3, 1)).toBe(0);
    expect(nextFrameIndex(0, 3, -1)).toBe(2);
    expect(reviewPurposeLabel("next")).toBe("What to do next");
  });

  it("keeps AI focus visible across auto, manual, and full-frame modes", () => {
    const focus = { centerX: 0.6, centerY: 0.4, radius: 0.12, arrowFromX: 0.8, arrowFromY: 0.2, label: "shoulder", confidence: 0.9 };
    expect(focusPresentation(focus, "auto")).toEqual(expect.objectContaining({ zoom: 1.7, showCircle: true, transformFocus: true }));
    expect(focusPresentation(focus, "manual", 2.2)).toEqual(expect.objectContaining({ zoom: 2.2, showCircle: true, transformFocus: true }));
    expect(focusPresentation(focus, "full")).toEqual(expect.objectContaining({ zoom: 1, showCircle: true, transformFocus: false }));
  });
});
