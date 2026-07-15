import { fireEvent, render } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import type { AnalysisResult, CoachingFinding } from "@/features/analysis/result-schema";

import { ResultsScreen } from ".";

function finding(id: string, title: string): CoachingFinding {
  return {
    id,
    title,
    detail: `${title} was visible during the set.`,
    whyItMatters: `${title} affects repeatable movement quality.`,
    correction: `Improve ${title.toLowerCase()}.`,
    cue: `Think ${title.toLowerCase()}.`,
    severity: "important",
    evidence: [{ startMs: 1_000, endMs: 1_600, repNumber: 1, phase: "concentric", visualEvidence: `${title} at rep 1.`, visibleBodyAreas: ["shoulders"], confidence: 0.9 }],
  };
}

function result(): AnalysisResult {
  return {
    status: "partial",
    recognition: { label: "High-to-low cable row", variation: null, equipment: ["cable machine"], confidence: 0.76, alternatives: ["High row"], catalogExerciseId: null, cameraView: "low" },
    videoCheck: { outcome: "partial", usableObservations: ["tempo", "elbow path"], limitations: ["hips obscured"], retryReason: null, retryInstruction: null },
    overallAssessment: "The visible repetitions were controlled and provided useful coaching evidence.",
    score: null,
    scoreRationale: [],
    didWell: Array.from({ length: 5 }, (_, index) => finding(`well-${index}`, `Did well ${index + 1}`)),
    priorityCorrections: Array.from({ length: 4 }, (_, index) => finding(`fix-${index}`, `Priority ${index + 1}`)),
    coachingCues: Array.from({ length: 4 }, (_, index) => finding(`cue-${index}`, `Coaching ${index + 1}`)),
    viewNote: "This low angle showed tempo and elbow path; hip position was obscured.",
    comparison: null,
  };
}

function renderResults(onFindingPress = jest.fn(), onRecordAnother = jest.fn(), onCorrectLabel: (label: string) => void | Promise<void> = jest.fn()) {
  return render(
    <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, right: 0, bottom: 34, left: 0 } }}>
      <ResultsScreen result={result()} onFindingPress={onFindingPress} onRecordAnother={onRecordAnother} onCorrectLabel={onCorrectLabel} />
    </SafeAreaProvider>,
  );
}

describe("ResultsScreen", () => {
  it("renders every supported coaching item without a fixed maximum", async () => {
    const screen = await renderResults();
    for (let index = 1; index <= 5; index += 1) expect(screen.getByText(`Did well ${index}`)).toBeTruthy();
    for (let index = 1; index <= 4; index += 1) {
      expect(screen.getByText(`Priority ${index}`)).toBeTruthy();
      expect(screen.getByText(`Coaching ${index}`)).toBeTruthy();
    }
  });

  it("omits an unsupported score while clearly explaining angle limits", async () => {
    const screen = await renderResults();
    expect(screen.queryByLabelText(/Movement quality/)).toBeNull();
    expect(screen.getByText(/low angle showed tempo and elbow path/i)).toBeTruthy();
    expect(screen.getByText("Likely High-to-low cable row")).toBeTruthy();
  });

  it("opens evidence and supports another recording", async () => {
    const onFindingPress = jest.fn();
    const onRecordAnother = jest.fn();
    const screen = await renderResults(onFindingPress, onRecordAnother);
    await fireEvent.press(screen.getByText("Priority 1"));
    await fireEvent.press(screen.getByText("Record Another Set"));
    expect(onFindingPress).toHaveBeenCalledWith(expect.objectContaining({ id: "fix-0" }));
    expect(onRecordAnother).toHaveBeenCalledTimes(1);
  });

  it("keeps label correction open and explains a save failure", async () => {
    const screen = await renderResults(jest.fn(), jest.fn(), async () => {
      throw new Error("Connection lost");
    });

    await fireEvent.press(screen.getByText("Correct exercise name"));
    await fireEvent.changeText(screen.getByLabelText("Exercise name"), "Cable Row");
    await fireEvent.press(screen.getByText("Save Correction"));

    expect(await screen.findByText("Connection lost")).toBeTruthy();
    expect(screen.getAllByText("Correct exercise name").length).toBeGreaterThan(1);
  });
});
