import { fireEvent, render } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import type { AnalysisResult, CoachingFinding } from "@/features/analysis/result-schema";
import type { TutorialVideo } from "@/features/analysis/api";

import { formatAnalysisTimestamp, ResultsScreen } from ".";

describe("formatAnalysisTimestamp", () => {
  it("carries rounded seconds into the next minute", () => {
    expect(formatAnalysisTimestamp(59_990)).toBe("01:00.0");
  });
});

function finding(id: string, title: string): CoachingFinding {
  return {
    id,
    title,
    detail: `${title} was visible during the set.`,
    whyItMatters: `${title} affects repeatable movement quality.`,
    correction: `Improve ${title.toLowerCase()}.`,
    cue: `Think ${title.toLowerCase()}.`,
    severity: "important",
    evidence: [
      { startMs: 1_000, peakMs: 1_300, endMs: 1_600, repNumber: 1, phase: "concentric", visualEvidence: `${title} at rep 1.`, coachingNote: "your right shoulder rises as the handle passes your ribs. Keep both shoulders level on the next pull.", visibleBodyAreas: ["shoulders"], confidence: 0.9, focusRegion: { centerX: 0.58, centerY: 0.36, radius: 0.12, arrowFromX: 0.82, arrowFromY: 0.18, label: "right shoulder", confidence: 0.9 } },
      { startMs: 2_000, peakMs: 2_300, endMs: 2_600, repNumber: null, phase: "reset", visualEvidence: `${title} between reps.`, coachingNote: "the shoulders stay uneven during the reset. Re-square before starting the next repetition.", visibleBodyAreas: ["shoulders"], confidence: 0.86, focusRegion: null },
    ],
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
    setContext: {
      cameraView: "down-front diagonal",
      visibleReferences: ["shoulders relative to the seat", "handle endpoint relative to the machine frame"],
      sequenceSummary: "Eight complete repetitions were visible from setup through the final reset.",
      changeAcrossSet: "The handle endpoint shortened during the final two repetitions.",
      coachingBasis: "Match the earlier handle endpoint while keeping both shoulders level.",
    },
    setSummary: { totalReps: 8, consistentReps: 6, verdict: "Good control. Elbow position changed near the end." },
    repTimeline: [
      { repNumber: 1, startMs: 500, peakMs: 1_000, endMs: 1_500, assessment: "consistent", note: "Controlled repetition." },
      { repNumber: 7, startMs: 8_000, peakMs: 8_500, endMs: 9_000, assessment: "breakdown", note: "Elbow travel increased." },
    ],
    nextSetPlan: [
      { id: "plan-1", action: "Keep your upper arms beside your torso", rationale: "Reduce late elbow travel.", relatedFindingId: "fix-0" },
      { id: "plan-2", action: "Lower each rep for two seconds", rationale: "Keep the tempo repeatable.", relatedFindingId: "cue-0" },
    ],
    precisionRequest: { requestedRuns: 0, reason: null, targets: [] },
    precisionReview: { runsRequested: 2, runsUsed: 2, status: "completed", summary: "Two premium precision runs completed.", passes: [{ passNumber: 1, kind: "recognition", outcome: "confirmed", reason: "Exercise identity confirmed.", checkedFindingId: null, startMs: null, endMs: null, usage: { promptTokens: 100, outputTokens: 20, thinkingTokens: 10 } }, { passNumber: 2, kind: "timestamp", outcome: "revised", reason: "Timestamp tightened.", checkedFindingId: "fix-0", startMs: 500, endMs: 2_000, usage: { promptTokens: 100, outputTokens: 20, thinkingTokens: 10 } }] },
    verification: { performed: true, reason: "Subtle late-set change", outcome: "revised", checkedFindingId: "fix-0" },
    comparison: null,
  };
}

function renderResults(onFindingPress = jest.fn(), onRecordAnother = jest.fn()) {
  return render(
    <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, right: 0, bottom: 34, left: 0 } }}>
      <ResultsScreen result={result()} videoUrl="https://storage.example/private-set.mp4" durationMs={12_000} onFindingPress={onFindingPress} onRecordAnother={onRecordAnother} />
    </SafeAreaProvider>,
  );
}

describe("ResultsScreen", () => {
  it("matches the focused Coaching Review hierarchy and includes every supported improvement point", async () => {
    const screen = await renderResults();

    expect(screen.getByText("COACHING REVIEW")).toBeTruthy();
    expect(screen.queryByText(/coaching points/i)).toBeNull();
    expect(screen.getByText("Review what happened, why it matters, and what to change next.")).toBeTruthy();
    expect(screen.getByText("What happened")).toBeTruthy();
    expect(screen.getByText("Why it matters")).toBeTruthy();
    expect(screen.getByText("What to do next")).toBeTruthy();
    expect(screen.getByText("Set Summary")).toBeTruthy();
    expect(screen.getByText("WHOLE-SET READ")).toBeTruthy();
    expect(screen.getByText("Eight complete repetitions were visible from setup through the final reset.")).toBeTruthy();
    expect(screen.getByText("The handle endpoint shortened during the final two repetitions.")).toBeTruthy();
    expect(screen.getByText("Match the earlier handle endpoint while keeping both shoulders level.")).toBeTruthy();
    expect(screen.getByText("Ask FORM Coach")).toBeTruthy();
    expect(screen.getByText("Camera visibility note")).toBeTruthy();
    expect(screen.queryByText(/pinch/i)).toBeNull();
    expect(screen.getByTestId("coaching-workspace")).toBeTruthy();
    expect(screen.getByTestId("active-coaching-panel").props.accessibilityLabel).toContain("What happened");
    expect(screen.getByLabelText("Recording timeline").props.accessibilityRole).toBe("adjustable");
    expect(screen.getByLabelText("Play recording in video")).toBeTruthy();
    expect(screen.getAllByLabelText(/Review .* at/).length).toBeGreaterThan(0);
    expect(screen.getAllByTestId(/timeline-evidence-marker-/).length).toBeGreaterThan(0);
    await fireEvent.press(screen.getByText("Why it matters"));
    expect(screen.getByTestId("active-coaching-panel").props.accessibilityLabel).toContain("Why it matters");
  }, 10_000);

  it("renders the supported strengths and focused next-set plan", async () => {
    const screen = await renderResults();
    for (let index = 1; index <= 5; index += 1) expect(screen.getByText(`Did well ${index}`)).toBeTruthy();
    expect(screen.getByText("Improve priority 1.")).toBeTruthy();
    await fireEvent.press(screen.getByText("What to do next"));
    expect(screen.getByText("Keep your upper arms beside your torso")).toBeTruthy();
    expect(screen.getByText("1 of 16")).toBeTruthy();
    await fireEvent.press(screen.getByLabelText("Next coaching point"));
    expect(screen.getAllByText("Priority 2").length).toBeGreaterThanOrEqual(1);
  });

  it("omits an unsupported score while keeping exercise-specific coaching", async () => {
    const screen = await renderResults();
    expect(screen.queryByLabelText(/Movement quality/)).toBeNull();
    expect(screen.queryByText(/low angle showed tempo and elbow path/i)).toBeNull();
    expect(screen.getByText("High-to-low cable row")).toBeTruthy();
    expect(screen.getByText("COACHING REVIEW")).toBeTruthy();
  });

  it("opens evidence and supports another recording", async () => {
    const onFindingPress = jest.fn();
    const onRecordAnother = jest.fn();
    const screen = await renderResults(onFindingPress, onRecordAnother);
    await fireEvent.press(screen.getByText("Priority: priority 1"));
    await fireEvent.press(screen.getByText("Record Another Set"));
    expect(onFindingPress).toHaveBeenCalledWith(expect.objectContaining({ id: "fix-0" }));
    expect(onRecordAnother).toHaveBeenCalledTimes(1);
  });

  it("lets the user immediately retry an unusable recording", async () => {
    const unusable = result();
    unusable.status = "unable";
    unusable.recognition = { label: null, variation: null, equipment: [], confidence: 0, alternatives: [], catalogExerciseId: null, exerciseFamily: "other" };
    unusable.videoCheck = { outcome: "unable", usableObservations: [], limitations: [], retryReason: "The full movement was not visible.", retryInstruction: "Record again with your full body and equipment visible." };
    unusable.overallAssessment = null;
    unusable.didWell = [];
    unusable.priorityCorrections = [];
    unusable.coachingCues = [];
    unusable.score = null;
    unusable.scoreRationale = [];
    unusable.setSummary = { totalReps: null, consistentReps: null, verdict: null };
    unusable.repTimeline = [];
    unusable.nextSetPlan = [];
    unusable.precisionReview = { runsRequested: 0, runsUsed: 0, status: "not-needed", summary: null, passes: [] };

    const onRecordAnother = jest.fn();
    const screen = await render(
      <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, right: 0, bottom: 34, left: 0 } }}>
        <ResultsScreen result={unusable} onFindingPress={jest.fn()} onRecordAnother={onRecordAnother} />
      </SafeAreaProvider>,
    );

    expect(screen.getByText("RECORDING UNUSABLE")).toBeTruthy();
    await fireEvent.press(screen.getByText("Record Again"));
    expect(onRecordAnother).toHaveBeenCalledTimes(1);
  });

  it("turns the result into an evidence-led coaching loop", async () => {
    const onFindingPress = jest.fn();
    const screen = await renderResults(onFindingPress);

    expect(screen.getByText("COACHING REVIEW")).toBeTruthy();
    expect(screen.getByText("What happened")).toBeTruthy();
    expect(screen.getByText("Why it matters")).toBeTruthy();
    expect(screen.getByText("What to do next")).toBeTruthy();
    expect(screen.queryByText("6 of 8 reps consistent")).toBeNull();
    expect(screen.getByText("Set Summary")).toBeTruthy();
    expect(screen.getByText("1 of 16")).toBeTruthy();
    expect(screen.getByText("your right shoulder rises as the handle passes your ribs. Keep both shoulders level on the next pull.")).toBeTruthy();
    expect(screen.getByText("Evidence checked")).toBeTruthy();
    expect(screen.queryByText(/premium run/i)).toBeNull();
    expect(screen.queryByText(/tokens/)).toBeNull();
    expect(screen.getByText("Ask FORM Coach")).toBeTruthy();
    expect(screen.queryByLabelText(/Coaching point:/)).toBeNull();
    expect(screen.queryByLabelText(/AI focus:/)).toBeNull();
    expect(screen.queryByText(/^Rep \d+$/)).toBeNull();
    expect(screen.getAllByText("your right shoulder rises as the handle passes your ribs. Keep both shoulders level on the next pull.").length).toBeGreaterThanOrEqual(1);

    await fireEvent.press(screen.getByText("Did well 1"));
    expect(onFindingPress).toHaveBeenCalledWith(expect.objectContaining({ id: "well-0" }));
  });

  it("makes record another set the dominant result action", async () => {
    const screen = await renderResults();
    expect(screen.getByTestId("record-another-loop")).toHaveStyle({ minHeight: 72 });
  });

  it("does not expose the removed body-analysis pipeline", async () => {
    const screen = await render(
      <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, right: 0, bottom: 34, left: 0 } }}>
        <ResultsScreen
          result={result()}
          onFindingPress={jest.fn()}
          onRecordAnother={jest.fn()}
        />
      </SafeAreaProvider>,
    );
    expect(screen.queryByText("Movement tracking")).toBeNull();
    expect(screen.queryByText("MoveNet Thunder")).toBeNull();
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

  it("keeps internal precision-run receipts out of the coaching UI", async () => {
    const failed = result();
    failed.precisionReview = {
      runsRequested: 2,
      runsUsed: 1,
      status: "failed",
      summary: "Premium review stopped after the first failed request.",
      passes: [{ passNumber: 1, kind: "technique", outcome: "failed", reason: "Gemini premium review failed: 503", checkedFindingId: "fix-0", startMs: 500, endMs: 2_000, usage: { promptTokens: 0, outputTokens: 0, thinkingTokens: 0 } }],
    };
    const screen = await render(
      <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, right: 0, bottom: 34, left: 0 } }}>
        <ResultsScreen result={failed} onFindingPress={jest.fn()} onRecordAnother={jest.fn()} />
      </SafeAreaProvider>,
    );

    expect(screen.queryByText(/attempted/i)).toBeNull();
    expect(screen.queryByText(/review failure/i)).toBeNull();
    expect(screen.queryByText("1 additional evidence run completed")).toBeNull();
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
    expect(screen.getByText("Watch Example")).toBeTruthy();
    await fireEvent.press(screen.getByLabelText("Watch Clear Cable Row Tutorial example"));
    expect(onOpenTutorial).toHaveBeenCalledWith(tutorial);
  });
});
