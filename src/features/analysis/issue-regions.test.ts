import { deriveObservedIssueRegions } from "./issue-regions";

describe("deriveObservedIssueRegions", () => {
  it("keeps provider regions when they are present", () => {
    expect(deriveObservedIssueRegions([{
      observedIssueRegions: ["knees"],
      evidence: [{ visibleBodyAreas: ["feet", "ankles"] }],
    }])).toEqual(["knees"]);
  });

  it("recovers legacy form-map regions from the finding's own visible evidence", () => {
    expect(deriveObservedIssueRegions([{
      observedIssueRegions: [],
      evidence: [
        { visibleBodyAreas: ["feet", "ankles"] },
        { visibleBodyAreas: ["torso", "chest"] },
      ],
    }])).toEqual(["ankles", "torso", "chest"]);
  });

  it("does not turn equipment or generic limb labels into unsupported anatomy", () => {
    expect(deriveObservedIssueRegions([{
      evidence: [{ visibleBodyAreas: ["dumbbell", "bar", "full movement", "legs"] }],
    }])).toEqual([]);
  });

  it("maps side-qualified and compound evidence labels instead of showing no observed areas", () => {
    expect(deriveObservedIssueRegions([{
      evidence: [{ visibleBodyAreas: ["left foot and ankle", "right shoulder blade", "both wrists"] }],
    }])).toEqual(["ankles", "upper_back", "wrists"]);
  });
});
