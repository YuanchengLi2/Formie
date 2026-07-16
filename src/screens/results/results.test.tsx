import { fireEvent, render } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import type { AnalysisResult, CoachingFinding } from "@/features/analysis/result-schema";
import type { TutorialVideo } from "@/features/analysis/api";

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
    evidence: [{ startMs: 1_000, peakMs: 1_300, endMs: 1_600, repNumber: 1, phase: "concentric", visualEvidence: `${title} at rep 1.`, visibleBodyAreas: ["shoulders"], confidence: 0.9 }],
  };
}

function result(): AnalysisResult {
  return {
    status: "partial",
    recognition: { label: "High-to-low cable row", variation: null, equipment: ["cable machine"], confidence: 0.76, alternatives: ["High row"], catalogExerciseId: null, exerciseFamily: "row" },
    videoCheck: { outcome: "partial", usableObservations: ["tempo", "elbow path"], limitations: ["hips obscured"], retryReason: null, retryInstruction: null },
    overallAssessment: "The visible repetitions were controlled and provided useful coaching evidence.",
    score: null,
    scoreRationale: [],
    didWell: Array.from({ length: 5 }, (_, index) => finding(`well-${index}`, `Did well ${index + 1}`)),
    priorityCorrections: Array.from({ length: 4 }, (_, index) => finding(`fix-${index}`, `Priority ${index + 1}`)),
    coachingCues: Array.from({ length: 4 }, (_, index) => finding(`cue-${index}`, `Coaching ${index + 1}`)),
    setSummary: { totalReps: 8, consistentReps: 6, verdict: "Good control. Elbow position changed near the end." },
    repTimeline: [
      { repNumber: 1, startMs: 500, peakMs: 1_000, endMs: 1_500, assessment: "consistent", note: "Controlled repetition." },
      { repNumber: 7, startMs: 8_000, peakMs: 8_500, endMs: 9_000, assessment: "breakdown", note: "Elbow travel increased." },
    ],
    nextSetPlan: [
      { id: "plan-1", action: "Keep your upper arms beside your torso", rationale: "Reduce late elbow travel.", relatedFindingId: "fix-0" },
      { id: "plan-2", action: "Lower each rep for two seconds", rationale: "Keep the tempo repeatable.", relatedFindingId: "cue-0" },
    ],
    verification: { performed: true, reason: "Subtle late-set change", outcome: "revised", checkedFindingId: "fix-0" },
    comparison: null,
  };
}

function renderResults(onFindingPress = jest.fn(), onRecordAnother = jest.fn()) {
  return render(
    <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, right: 0, bottom: 34, left: 0 } }}>
      <ResultsScreen result={result()} videoUrl="https://storage.example/private-set.mp4" onFindingPress={onFindingPress} onRecordAnother={onRecordAnother} />
    </SafeAreaProvider>,
  );
}

describe("ResultsScreen", () => {
  it("renders the supported strengths and focused next-set plan", async () => {
    const screen = await renderResults();
    for (let index = 1; index <= 5; index += 1) expect(screen.getByText(`Did well ${index}`)).toBeTruthy();
    expect(screen.getByText("Improve priority 1.")).toBeTruthy();
    expect(screen.getByText("Keep your upper arms beside your torso")).toBeTruthy();
    expect(screen.queryByText("Priority 4")).toBeNull();
  });

  it("omits an unsupported score while keeping exercise-specific coaching", async () => {
    const screen = await renderResults();
    expect(screen.queryByLabelText(/Movement quality/)).toBeNull();
    expect(screen.queryByText(/low angle showed tempo and elbow path/i)).toBeNull();
    expect(screen.getByText("High-to-low cable row")).toBeTruthy();
    expect(screen.getByText("COACH’S REVIEW")).toBeTruthy();
  });

  it("opens evidence and supports another recording", async () => {
    const onFindingPress = jest.fn();
    const onRecordAnother = jest.fn();
    const screen = await renderResults(onFindingPress, onRecordAnother);
    await fireEvent.press(screen.getByText("Improve priority 1."));
    await fireEvent.press(screen.getByText("Record Another Set"));
    expect(onFindingPress).toHaveBeenCalledWith(expect.objectContaining({ id: "fix-0" }));
    expect(onRecordAnother).toHaveBeenCalledTimes(1);
  });

  it("turns the result into an evidence-led coaching loop", async () => {
    const onFindingPress = jest.fn();
    const screen = await renderResults(onFindingPress);

    expect(screen.getByText("COACH’S REVIEW")).toBeTruthy();
    expect(screen.getByText("BIGGEST IMPROVEMENT")).toBeTruthy();
    expect(screen.getByText("FULL RECORDING")).toBeTruthy();
    expect(screen.getByText("6 of 8 reps consistent")).toBeTruthy();
    expect(screen.getByText("NEXT SET PLAN")).toBeTruthy();
    expect(screen.getByText("Evidence checked")).toBeTruthy();
    expect(screen.getByText("See if your correction worked")).toBeTruthy();

    await fireEvent.press(screen.getByText("Did well 1"));
    await fireEvent.press(screen.getByText("Keep your upper arms beside your torso"));
    expect(onFindingPress).toHaveBeenCalledWith(expect.objectContaining({ id: "well-0" }));
    expect(onFindingPress).toHaveBeenCalledWith(expect.objectContaining({ id: "fix-0" }));
  });

  it("makes record another set the dominant result action", async () => {
    const screen = await renderResults();
    expect(screen.getByTestId("record-another-loop")).toHaveStyle({ minHeight: 92 });
  });

  it("does not claim evidence was checked when the verifier failed", async () => {
    const failed = result();
    failed.verification = { performed: true, reason: "Verifier unavailable", outcome: "failed", checkedFindingId: "fix-0" };
    const screen = await render(
      <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, right: 0, bottom: 34, left: 0 } }}>
        <ResultsScreen result={failed} onFindingPress={jest.fn()} onRecordAnother={jest.fn()} />
      </SafeAreaProvider>,
    );
    expect(screen.queryByText("Evidence checked")).toBeNull();
  });

  it("removes exercise-name correction from the result flow", async () => {
    const screen = await renderResults();
    expect(screen.queryByText("Correct exercise name")).toBeNull();
    expect(screen.queryByLabelText("Exercise name")).toBeNull();
  });

  it("opens the verified exercise tutorial selected after analysis", async () => {
    const tutorial: TutorialVideo = { videoId: "abcdefghijk", url: "https://www.youtube.com/watch?v=abcdefghijk", title: "Clear Cable Row Tutorial", channel: "Trusted Coach", whyChosen: "Shows setup and execution clearly.", thumbnailUrl: "https://i.ytimg.com/vi/abcdefghijk/hqdefault.jpg", searchAttributionHtml: null };
    const onOpenTutorial = jest.fn();
    const screen = await render(
      <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, right: 0, bottom: 34, left: 0 } }}>
        <ResultsScreen result={result()} tutorial={tutorial} onOpenTutorial={onOpenTutorial} onFindingPress={jest.fn()} onRecordAnother={jest.fn()} />
      </SafeAreaProvider>,
    );
    expect(screen.getByText("How to do this exercise properly")).toBeTruthy();
    await fireEvent.press(screen.getByLabelText("Watch Clear Cable Row Tutorial on YouTube"));
    expect(onOpenTutorial).toHaveBeenCalledWith(tutorial);
  });
});
