import {
  buildCoachGrounding,
  normalizeCoachLocation,
  parseCoachAnswer,
  parseCoachLocation,
  renderCoachAnswer,
} from "./coach-analysis";

describe("coach video analysis contracts", () => {
  it("normalizes a focused event into a padded bounded review window", () => {
    const location = parseCoachLocation({
      scope: "focused_window",
      startMs: 5_000,
      endMs: 8_000,
      rationale: "The user referred to the fourth repetition.",
      clarification: null,
    });

    expect(normalizeCoachLocation(location, 20_000)).toEqual({
      ...location,
      startMs: 3_500,
      endMs: 9_500,
    });
  });

  it("caps focused review windows at fifteen seconds and rejects invalid ranges", () => {
    const location = parseCoachLocation({
      scope: "focused_window",
      startMs: 2_000,
      endMs: 19_000,
      rationale: "A long event was selected.",
      clarification: null,
    });
    expect(normalizeCoachLocation(location, 30_000)).toMatchObject({ startMs: 3_000, endMs: 18_000 });
    expect(() => parseCoachLocation({ scope: "focused_window", startMs: 4_000, endMs: 2_000, rationale: "bad", clarification: null })).toThrow(/range/i);
    expect(() => parseCoachLocation({ scope: "whole_set", startMs: 0, endMs: 4_000, rationale: "bad", clarification: null })).toThrow(/whole_set/i);
    expect(() => parseCoachLocation({ scope: "whole_set", startMs: null, endMs: null, rationale: "ok", clarification: null, extra: true })).toThrow(/unexpected/i);
  });

  it("converts clip-relative citations to original-video timestamps", () => {
    const location = normalizeCoachLocation(parseCoachLocation({ scope: "focused_window", startMs: 5_000, endMs: 8_000, rationale: "Rep four", clarification: null }), 20_000);
    const answer = parseCoachAnswer({
      directAnswer: "Your right elbow moves away from your torso near the top.",
      observations: [{ offsetMs: 2_000, label: "Right elbow begins to flare." }],
      visibilityLimitations: [],
      nextSetAction: "Keep the elbow tracking beside the torso.",
    }, location.endMs! - location.startMs!);

    expect(buildCoachGrounding(location, answer, 20_000)).toEqual({
      scope: "focused_window",
      startMs: 3_500,
      endMs: 9_500,
      citations: [{ timeMs: 5_500, label: "Right elbow begins to flare." }],
    });
    expect(renderCoachAnswer(answer, buildCoachGrounding(location, answer, 20_000))).toContain("00:05.5");
  });

  it("rejects citations outside the reviewed media and supports insufficient clarification", () => {
    expect(() => parseCoachAnswer({ directAnswer: "No", observations: [{ offsetMs: 4_001, label: "Outside" }], visibilityLimitations: [], nextSetAction: null }, 4_000)).toThrow(/citation/i);
    expect(parseCoachLocation({ scope: "insufficient", startMs: null, endMs: null, rationale: "The reference is ambiguous.", clarification: "Which repetition do you mean?" })).toMatchObject({ scope: "insufficient" });
  });
});
