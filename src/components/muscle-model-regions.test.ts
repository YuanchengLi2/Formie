import { isAnatomyMuscleTag, muscleModelHighlightForTag } from "./muscle-model-regions";

describe("3D muscle model region highlights", () => {
  it("colors target, supporting, and issue geometry with issue priority", () => {
    const selection = {
      targetRegions: ["lats"] as const,
      secondaryRegions: ["biceps"] as const,
      issueRegions: ["shoulders"] as const,
    };

    expect(muscleModelHighlightForTag("lats", selection)).toBe("target");
    expect(muscleModelHighlightForTag("biceps", selection)).toBe("secondary");
    expect(muscleModelHighlightForTag("deltoids", selection)).toBe("issue");
  });

  it("keeps unselected body geometry on the opaque base material", () => {
    expect(muscleModelHighlightForTag("quads", {
      targetRegions: [],
      secondaryRegions: [],
      issueRegions: [],
    })).toBe("base");
  });

  it("accepts only muscle tags carried by the segmented asset", () => {
    expect(isAnatomyMuscleTag("deltoids")).toBe(true);
    expect(isAnatomyMuscleTag("rough-shoulder-zone")).toBe(false);
  });
});
