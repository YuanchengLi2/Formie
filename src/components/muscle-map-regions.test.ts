import {
  muscleMapHighlightsForFace,
  preferredMuscleMapFace,
} from "./muscle-map-regions";

describe("muscle map region highlighting", () => {
  it("colors the actual front-facing SVG muscle groups for primary and supporting targets", () => {
    expect(muscleMapHighlightsForFace("front", ["chest"], ["biceps"], [])).toEqual([
      { slug: "chest", kind: "target" },
      { slug: "biceps", kind: "secondary" },
    ]);
  });

  it("maps posterior targets to the body map's native back-muscle paths", () => {
    expect(muscleMapHighlightsForFace("back", ["lats", "upper_back"], [], [])).toEqual([
      { slug: "upper-back", kind: "target" },
      { slug: "trapezius", kind: "target" },
    ]);
  });

  it("gives an observed form issue priority over target coloring on the same muscle path", () => {
    expect(muscleMapHighlightsForFace("front", ["front_shoulders"], [], ["shoulders"])).toEqual([
      { slug: "deltoids", kind: "issue" },
    ]);
  });

  it("chooses the face containing the most directly highlighted anatomy", () => {
    expect(preferredMuscleMapFace(["lats", "upper_back"], [], [])).toBe("back");
    expect(preferredMuscleMapFace(["chest", "biceps"], [], [])).toBe("front");
  });
});
