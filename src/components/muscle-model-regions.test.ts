import { muscleModelHighlightForPart, muscleModelPartAtPosition } from "./muscle-model-regions";

describe("3D muscle model region highlights", () => {
  it("colors target, supporting, and issue geometry with issue priority", () => {
    const selection = {
      targetRegions: ["lats"] as const,
      secondaryRegions: ["biceps"] as const,
      issueRegions: ["shoulders"] as const,
    };

    expect(muscleModelHighlightForPart("left-lat", selection)).toBe("target");
    expect(muscleModelHighlightForPart("right-biceps", selection)).toBe("secondary");
    expect(muscleModelHighlightForPart("left-deltoid", selection)).toBe("issue");
  });

  it("keeps unselected body geometry on the opaque base material", () => {
    expect(muscleModelHighlightForPart("left-quad", {
      targetRegions: [],
      secondaryRegions: [],
      issueRegions: [],
    })).toBe("base");
  });

  it("maps front and back vertices to different anatomical surfaces", () => {
    expect(muscleModelPartAtPosition(-0.18, 0.18, 0.3)).toBe("left-chest");
    expect(muscleModelPartAtPosition(-0.18, 0.18, -0.3)).toBe("left-lat");
    expect(muscleModelPartAtPosition(0.18, -0.2, 0.3)).toBe("right-quad");
    expect(muscleModelPartAtPosition(0.18, -0.2, -0.3)).toBe("right-hamstring");
  });
});
