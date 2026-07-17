import type { AnalysisResult, CoachingFinding } from "./result-schema";
import { findResultFinding, findResultFindingContext } from "./result-store";

const finding = { id: "target" } as CoachingFinding;
const result = {
  didWell: [],
  priorityCorrections: [finding],
  coachingCues: [],
} as unknown as AnalysisResult;

it("finds a coaching item across every feedback section", () => {
  expect(findResultFinding(result, "target")).toBe(finding);
  expect(findResultFinding(result, "missing")).toBeNull();
});

it("returns the feedback section so each detail page can explain its role", () => {
  expect(findResultFindingContext(result, "target")).toEqual({ finding, section: "correction" });
  expect(findResultFindingContext(result, "missing")).toBeNull();
});
