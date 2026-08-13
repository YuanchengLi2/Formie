import { fireEvent, render } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import type { AnalysisResult, CoachingFinding } from "@/features/analysis/result-schema";
import { colors } from "@/theme/colors";
import { conciseCopy, formatAnalysisTimestamp, plainCoachingText, ResultsScreen } from ".";

describe("formatAnalysisTimestamp", () => {
  it("carries rounded seconds into the next minute", () => {
    expect(formatAnalysisTimestamp(59_990)).toBe("01:00.0");
  });
});

describe("conciseCopy", () => {
  it("keeps only the requested sentences and words", () => {
    expect(conciseCopy(
      "The first sentence is clear. The second sentence stays useful. This third sentence should disappear.",
      2,
      10,
    )).toBe("The first sentence is clear. The second sentence stays useful.");
  });
});

describe("plainCoachingText", () => {
  it("removes Markdown emphasis and bullet markers from persisted coaching", () => {
    expect(plainCoachingText("**Keep the wrists straight.**\n- Match both sides.")).toBe("Keep the wrists straight. Match both sides.");
  });
});

function finding(id: string, title: string): CoachingFinding {
  return {
    id,
    coachingArea: "form",
    title,
    detail: `${title} was visible during the set.`,
    whyItMatters: `${title} affects repeatable movement quality.`,
    correction: `Improve ${title.toLowerCase()}.`,
    cue: `Think ${title.toLowerCase()}.`,
    actionableCorrection: {
      instruction: `Improve ${title.toLowerCase()}.`,
      cue: `Think ${title.toLowerCase()}.`,
      successCheck: `${title} stays repeatable.`,
      applyWhen: "During the next set.",
    },
    expandedCoaching: {
      summary: `${title} changes the movement.`,
      whatHappened: "Your right shoulder rises before the weight changes direction.",
      whatHappenedDetail: "On rep 1, the right shoulder moves above the left as the weight rises. The uneven position is clearest at the cited frame.",
      whyItMatters: "The uneven shoulder position tilts the visible weight path.",
      whyItMattersDetail: "The next repetition starts from a different shoulder position. That makes the recorded pulling path less repeatable.",
      whatToDo: "Start the next rep with both shoulders level.",
      successCheck: "Both shoulders finish at the same height.",
    } as NonNullable<CoachingFinding["expandedCoaching"]> & { whatHappenedDetail: string; whyItMattersDetail: string },
    severity: "important",
    observedIssueRegions: ["shoulders"],
    primaryEvidenceIndex: 0,
    evidence: [
      { startMs: 1_000, peakMs: 1_300, endMs: 1_600, repNumber: 1, phase: "concentric", visualEvidence: `${title} at rep 1.`, coachingNote: "your right shoulder rises as the handle passes your ribs. Keep both shoulders level on the next pull.", visibleBodyAreas: ["shoulders"], confidence: 0.9, focusRegion: { centerX: 0.58, centerY: 0.36, radius: 0.12, arrowFromX: 0.82, arrowFromY: 0.18, label: "right shoulder", confidence: 0.9 } },
      { startMs: 2_000, peakMs: 2_300, endMs: 2_600, repNumber: null, phase: "reset", visualEvidence: `${title} between reps.`, coachingNote: "the shoulders stay uneven during the reset. Re-square before starting the next repetition.", visibleBodyAreas: ["shoulders"], confidence: 0.86, focusRegion: null },
    ],
  };
}

function result(): AnalysisResult {
  return {
    status: "partial",
    analysisBasis: "observed",
    viewNotes: ["Hips are partly obscured."],
    generalGuidance: ["Keep the setup stable.", "Use a controlled range."],
    recognition: { label: "High-to-low cable row", variation: null, equipment: ["cable machine"], confidence: 0.76, alternatives: ["High row"], catalogExerciseId: null, exerciseFamily: "row" },
    videoCheck: { outcome: "partial", usableObservations: ["tempo", "elbow path"], limitations: ["hips obscured"], retryReason: null, retryInstruction: null },
    overallAssessment: "The set keeps a stable base while the shoulder position changes late. The opening movement is controlled and the handle path stays repeatable. The main weakness is the late shoulder rise, so keep both shoulders level on the next set.",
    muscleFocus: {
      primary: [
        { name: "Latissimus dorsi", region: "lats" },
        { name: "Upper back", region: "upper_back" },
      ],
      secondary: [{ name: "Biceps", region: "biceps" }],
      unclassified: [],
    },
    coachNote: "Your early repetitions establish a controlled path. Carry that same shoulder position through the end so the final movement matches the beginning.",
    score: 75,
    scoreRationale: [],
    movementScores: [
      { id: "handle-path", label: "Handle Path", score: 78, observed: "The handle path remains steady until the final repetitions.", evidenceIds: ["fix-0"] },
      { id: "shoulder-level", label: "Shoulder Level", score: 66, observed: "The right shoulder rises near the end of the set.", evidenceIds: ["fix-0"] },
      { id: "lowering-control", label: "Lowering Control", score: 84, observed: "The return stays controlled across most repetitions.", evidenceIds: ["fix-1"] },
      { id: "rep-consistency", label: "Rep Consistency", score: 72, observed: "The final repetitions differ from the opening pattern.", evidenceIds: ["fix-0"] },
    ],
    equipmentObservations: [{ id: "stack-load", category: "visible_load", title: "Selected stack load", observation: "The selector is visible, but the selected number is not readable.", coachingRelevance: "Use the same visible selector position when comparing the next set.", load: { value: null, unit: null, scope: null, certainty: "unknown", basis: "not_readable" }, evidence: [{ startMs: 1_000, peakMs: 1_300, endMs: 1_600, visualEvidence: "The selector pin is visible while the number is blurred.", visibleReferences: ["weight stack", "selector pin"], confidence: 0.88, focusRegion: null }] }],
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
      { id: "plan-1", action: "Keep your upper arms beside your torso", rationale: "Reduce late elbow travel.", successCheck: "The elbows stay beside the torso.", relatedFindingId: "fix-0" },
      { id: "plan-2", action: "Lower each rep for two seconds", rationale: "Keep the tempo repeatable.", successCheck: "Each lowering phase lasts two seconds.", relatedFindingId: "fix-1" },
    ],
    precisionRequest: { requestedRuns: 0, reason: null, targets: [] },
    comparison: null,
    setDeclaration: {
      exercise: { source: "catalog", catalogExerciseId: 3, label: "Dumbbell Bench Press" },
      amount: { kind: "reps", value: 8, countScope: "total" },
      load: { kind: "known", value: 40, unit: "lb", scope: "per_hand" },
      side: "bilateral",
      styles: [],
      focusNote: null,
    },
  };
}

function renderResults(onRecordAnother = jest.fn(), value = result()) {
  return render(
    <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, right: 0, bottom: 34, left: 0 } }}>
      <ResultsScreen result={value} videoUrl="https://storage.example/private-set.mp4" durationMs={12_000} playbackWindow={{ sourceStartMs: 500, sourceEndMs: 10_000 }} onRecordAnother={onRecordAnother} exampleState="ready" onWatchExample={jest.fn()} />
    </SafeAreaProvider>,
  );
}

function renderedTestIds(node: unknown, ids: string[] = []): string[] {
  if (!node) return ids;
  if (Array.isArray(node)) {
    node.forEach((child) => renderedTestIds(child, ids));
    return ids;
  }
  if (typeof node === "string") return ids;
  if (typeof node !== "object") return ids;
  const rendered = node as { props?: { testID?: unknown }; children?: unknown[] };
  if (typeof rendered.props?.testID === "string") ids.push(rendered.props.testID);
  rendered.children?.forEach((child: unknown) => renderedTestIds(child, ids));
  return ids;
}

describe("ResultsScreen", () => {
  it("matches the focused Coaching Review hierarchy and includes every supported improvement point", async () => {
    const screen = await renderResults();

    expect(screen.getByText("COACHING REVIEW")).toBeTruthy();
    expect(screen.queryByTestId("issue-carousel")).toBeNull();
    expect(screen.queryByText("ALL COACHING POINTS")).toBeNull();
    expect(screen.queryByText("Each tab has one job: see the mistake, understand it, then fix one thing.")).toBeNull();
    expect(screen.getByText("WHAT HAPPENED")).toBeTruthy();
    expect(screen.queryByText("WHY IT MATTERS")).toBeNull();
    expect(screen.queryByText("WHAT TO DO NEXT")).toBeNull();
    await fireEvent.press(screen.getByLabelText("Why it matters"));
    expect(screen.getByText("WHY IT MATTERS")).toBeTruthy();
    await fireEvent.press(screen.getByLabelText("What to do next"));
    expect(screen.getByText("WHAT TO DO NEXT")).toBeTruthy();
    expect(screen.getAllByText("Start the next rep with both shoulders level.").length).toBeGreaterThan(0);
    await fireEvent.press(screen.getByLabelText("What happened"));
    expect(screen.getByText("WHOLE SET SUMMARY")).toBeTruthy();
    expect(screen.getByText("The set keeps a stable base while the shoulder position changes late. The opening movement is controlled and the handle path stays repeatable. The main weakness is the late shoulder rise, so keep both shoulders level on the next set.")).toBeTruthy();
    expect(screen.getByText("concentric · 00:00.8")).toBeTruthy();
    expect(screen.queryByText("WHOLE-SET READ")).toBeNull();
    expect(screen.queryByText("Eight complete repetitions were visible from setup through the final reset.")).toBeNull();
    expect(screen.queryByText("The handle endpoint shortened during the final two repetitions.")).toBeNull();
    expect(screen.queryByText("Match the earlier handle endpoint while keeping both shoulders level.")).toBeNull();
    expect(screen.getByText("Ask Formie Coach")).toBeTruthy();
    expect(screen.getByText("Watch Example")).toBeTruthy();
    expect(screen.queryByLabelText("FORM")).toBeNull();
    expect(screen.queryByText("Camera visibility note")).toBeNull();
    expect(screen.queryByText("Objective breakdown from your recording")).toBeNull();
    expect(screen.getByText("EXERCISE MUSCLE FOCUS")).toBeTruthy();
    expect(screen.getByText("SCORES")).toBeTruthy();
    expect(screen.queryByText("Your early repetitions establish a controlled path.")).toBeNull();
    expect(screen.getByTestId("coach-score-gauge").props.accessibilityRole).toBe("progressbar");
    expect(screen.getByTestId("movement-scores")).toBeTruthy();
    expect(screen.queryByText("WEAKNESSES")).toBeNull();
    expect(screen.queryByText(/drag to rotate/i)).toBeNull();
    expect(screen.getByTestId("coaching-workspace")).toBeTruthy();
    expect(screen.getByTestId("active-coaching-panel").props.accessibilityLabel).toContain("Priority 1");
    expect(screen.getByTestId("coaching-what-happened-copy")).toHaveStyle({ color: colors.text, fontSize: 15, lineHeight: 22, fontWeight: "700" });
    expect(screen.getByTestId("coaching-what-happened-copy").props.children).toBe("Your right shoulder rises before the weight changes direction.");
    expect(screen.getByTestId("coaching-what-happened-detail").props.children).toContain("On rep 1");
    expect(screen.queryByText("Priority 1 affects repeatable movement quality.")).toBeNull();
    expect(screen.getByLabelText("Recording timeline").props.accessibilityRole).toBe("adjustable");
    expect(screen.getByLabelText("Play recording in video")).toBeTruthy();
    expect(screen.getAllByLabelText(/Review .* at/).length).toBeGreaterThan(0);
    expect(screen.getAllByTestId(/timeline-evidence-marker-/)).toHaveLength(4);
  }, 10_000);

  it("renders What to do next as one complete white instruction without gray copy", async () => {
    const value = result();
    value.priorityCorrections[0].expandedCoaching!.whatToDo = "**Start the next rep with both shoulders level.**";
    const screen = await renderResults(jest.fn(), value);
    await fireEvent.press(screen.getByLabelText("What to do next"));
    const instruction = screen.getByTestId("coaching-what-to-do-next");
    expect(instruction.props.children).toBe("Start the next rep with both shoulders level.");
    expect(instruction).toHaveStyle({ fontWeight: "700" });
    expect(screen.queryByText(/\*/)).toBeNull();
    expect(screen.queryByTestId("coaching-what-to-do-next-detail")).toBeNull();
  });

  it("renders What happened as one coherent paragraph while keeping Why it matters separate", async () => {
    const screen = await renderResults();

    expect(screen.getByTestId("coaching-what-happened-copy").props.children).toBe("Your right shoulder rises before the weight changes direction.");
    expect(screen.getByTestId("coaching-what-happened-copy")).toHaveStyle({ color: colors.text, fontWeight: "700" });
    expect(screen.getByTestId("coaching-what-happened-detail").props.children).toContain("On rep 1");
    expect(screen.getByTestId("coaching-what-happened-detail")).toHaveStyle({ color: colors.textSecondary, fontWeight: "400" });

    await fireEvent.press(screen.getByLabelText("Why it matters"));
    expect(screen.getByTestId("coaching-why-it-matters-copy").props.children).toBe("The uneven shoulder position tilts the visible weight path.");
    expect(screen.getByTestId("coaching-why-it-matters-copy")).toHaveStyle({ color: colors.text, fontWeight: "700" });
    expect(screen.getByTestId("coaching-why-it-matters-detail").props.children).toContain("less repeatable");
    expect(screen.getByTestId("coaching-why-it-matters-detail")).toHaveStyle({ color: colors.textSecondary, fontWeight: "400" });
  });

  it("renders the supported strengths and focused next-set plan", async () => {
    const screen = await renderResults();
    for (let index = 1; index <= 3; index += 1) expect(screen.getByText(`Did well ${index}`)).toBeTruthy();
    expect(screen.queryByText("Did well 4")).toBeNull();
    expect(screen.queryByTestId("strengths-section")).toBeNull();
    expect(screen.getAllByTestId(/^summary-strength-well-\d+$/)).toHaveLength(3);
    expect(StyleSheet.flatten(screen.getByTestId("summary-strength-well-0").props.style)).toMatchObject({ color: colors.success });
    expect(StyleSheet.flatten(screen.getByTestId("summary-strength-well-0-card").props.style)).toMatchObject({ backgroundColor: "rgba(53,208,127,0.10)" });
    expect(screen.queryByTestId(/timeline-evidence-marker-observed-well-0-/)).toBeNull();
    expect(screen.getAllByTestId(/^summary-focus-fix-\d+$/)).toHaveLength(4);
    expect(screen.getAllByTestId(/^summary-next-/).filter((node) => !String(node.props.testID).endsWith("-card"))).toHaveLength(3);
    expect(screen.queryByText("Improve priority 1.")).toBeNull();
    expect(screen.getByText("YOUR NEXT SET")).toBeTruthy();
    expect(screen.getByText("Keep your upper arms beside your torso")).toBeTruthy();
    expect(screen.getByText("Lower each rep for two seconds")).toBeTruthy();
    expect(screen.queryByText("Reduce late elbow travel.")).toBeNull();
    expect(screen.queryByText("The elbows stay beside the torso.")).toBeNull();
    expect(screen.queryByText("Success check: Each lowering phase lasts two seconds.")).toBeNull();
    expect(screen.getByText("Issue 1 of 4")).toBeTruthy();
    await fireEvent.press(screen.getByLabelText("Next problem"));
    expect(screen.getAllByText("Priority 2").length).toBeGreaterThanOrEqual(1);
  });

  it("renders every returned correction instead of truncating focus areas at four", async () => {
    const value = result();
    value.priorityCorrections = Array.from({ length: 6 }, (_, index) => finding(`fix-${index}`, `Priority ${index + 1}`));
    const screen = await renderResults(jest.fn(), value);
    expect(screen.getAllByTestId(/^summary-focus-fix-\d+$/)).toHaveLength(6);
    expect(screen.getByText("Issue 1 of 6")).toBeTruthy();
  });

  it("orders the personalized set sections and gives every ranked weakness a next-set action", async () => {
    const screen = await renderResults();
    const ids = renderedTestIds(screen.toJSON());
    const sectionIds = [
      "coaching-workspace",
      "muscle-focus-section",
      "coach-note-scores-section",
      "whole-set-summary-section",
      "result-actions",
    ];

    expect(sectionIds.map((id) => ids.indexOf(id))).toEqual(
      [...sectionIds.map((id) => ids.indexOf(id))].sort((left, right) => left - right),
    );
    expect(screen.queryByTestId("weaknesses-section")).toBeNull();
    expect(screen.queryByTestId("next-set-section")).toBeNull();
  });

  it("keeps the post-analysis guide and six-domain audit internal", async () => {
    const value = result();
    value.exerciseGuide = {
      setupSteps: [
        "Set the cable just below shoulder height and clear the space behind you.",
        "Take a neutral grip and square both shoulders before the first pull.",
      ],
      executionSteps: [
        "Drive the elbows back while keeping the handle path level.",
        "Return under control without letting either shoulder rise.",
      ],
      relatedFindingIds: ["fix-0"],
    };
    value.coachingCoverage = [
      { domain: "surroundings", status: "clear", observation: "The working area stays clear.", findingIds: [] },
      { domain: "equipment_setup", status: "issue", observation: "The cable starts slightly too high.", findingIds: ["fix-0"] },
      { domain: "grip_contact", status: "clear", observation: "The grip remains neutral.", findingIds: [] },
      { domain: "starting_position", status: "issue", observation: "The right shoulder starts higher.", findingIds: ["fix-0"] },
      { domain: "movement_execution", status: "issue", observation: "The shoulder rises late in the set.", findingIds: ["fix-0"] },
      { domain: "support_balance", status: "not_visible", observation: "Foot pressure is outside the camera view.", findingIds: [] },
    ];

    const screen = await renderResults(jest.fn(), value);

    expect(screen.queryByTestId("exercise-guide-section")).toBeNull();
    expect(screen.queryByText("HOW TO SET UP AND DO THIS EXERCISE")).toBeNull();
    expect(screen.queryByText(/Set the cable just below shoulder height/)).toBeNull();
    expect(screen.queryByText("EQUIPMENT SETUP")).toBeNull();
    expect(screen.queryByText("STARTING POSITION")).toBeNull();
  });

  it("uses a rotatable anatomy model without circular body overlays", async () => {
    const screen = await renderResults();

    expect(screen.getByTestId("muscle-focus-figure")).toBeTruthy();
    expect(screen.getByTestId("anatomy-body-image")).toBeTruthy();
    expect(screen.getByLabelText("Rotatable anatomy model")).toBeTruthy();
    expect(screen.getByLabelText("Rotate anatomy")).toBeTruthy();
    expect(screen.queryByLabelText("Zoom out anatomy")).toBeNull();
    expect(screen.getByLabelText("Target Muscles").props.accessibilityState).toEqual({ selected: true });
    expect(screen.queryByTestId("anatomy-issue-shoulders")).toBeNull();
    expect(screen.getByText("Target Muscles")).toBeTruthy();
    expect(screen.getByText("Your Form")).toBeTruthy();
    expect(screen.queryByText("Observed issue areas")).toBeNull();
    expect(screen.queryByText(/never claims actual muscle activation/i)).toBeNull();
    expect(screen.getByTestId("anatomy-gesture-surface")).toBeTruthy();
    expect(renderedTestIds(screen.toJSON()).some((id) => id.startsWith("anatomy-highlight-issue-"))).toBe(false);
    expect(screen.getByTestId("anatomy-target-lats")).toBeTruthy();
    expect(screen.getByTestId("anatomy-target-upper_back")).toBeTruthy();
    expect(screen.getByTestId("anatomy-secondary-biceps")).toBeTruthy();
    expect(screen.getByText("Primary muscles")).toBeTruthy();
    expect(screen.getByText("Supporting muscles")).toBeTruthy();
    await fireEvent.press(screen.getByLabelText("Your Form"));
    expect(screen.getByTestId("anatomy-issue-shoulders")).toBeTruthy();
    expect(screen.getByText("Observed issue areas")).toBeTruthy();
    expect(renderedTestIds(screen.toJSON()).some((id) => id.startsWith("anatomy-highlight-issue-"))).toBe(true);
  });

  it("highlights only the currently selected coaching issue on the form map", async () => {
    const value = result();
    value.priorityCorrections[1] = {
      ...value.priorityCorrections[1],
      observedIssueRegions: ["ankles"],
      evidence: value.priorityCorrections[1].evidence.map((moment) => ({ ...moment, visibleBodyAreas: ["ankles"] })),
    };
    const screen = await renderResults(jest.fn(), value);

    await fireEvent.press(screen.getByLabelText("Your Form"));
    expect(screen.getByTestId("anatomy-issue-shoulders")).toBeTruthy();
    expect(screen.queryByTestId("anatomy-issue-ankles")).toBeNull();

    await fireEvent.press(screen.getByLabelText("Next problem"));
    expect(screen.getByTestId("anatomy-issue-ankles")).toBeTruthy();
    expect(screen.queryByTestId("anatomy-issue-shoulders")).toBeNull();
  });

  it("still renders red issue regions when a custom exercise has no target-muscle catalog entry", async () => {
    const value = result();
    value.setDeclaration = {
      ...value.setDeclaration!,
      exercise: { source: "custom", catalogExerciseId: null, label: "Custom cable movement" },
    };
    const screen = await renderResults(jest.fn(), value);

    expect(screen.getByTestId("muscle-focus-figure")).toBeTruthy();
    await fireEvent.press(screen.getByLabelText("Your Form"));
    expect(screen.getByTestId("anatomy-issue-shoulders")).toBeTruthy();
    expect(renderedTestIds(screen.toJSON()).some((id) => id.startsWith("anatomy-highlight-issue-"))).toBe(true);
  });

  it("recovers observed issue areas from legacy evidence when the provider region field is empty", async () => {
    const value = result();
    value.priorityCorrections = value.priorityCorrections.map((item) => ({
      ...item,
      observedIssueRegions: [],
      evidence: item.evidence.map((moment) => ({ ...moment, visibleBodyAreas: ["feet", "ankles"] })),
    }));
    const screen = await renderResults(jest.fn(), value);

    await fireEvent.press(screen.getByLabelText("Your Form"));
    expect(screen.getByLabelText("Your Form").props.accessibilityState).toEqual({ selected: true });
    expect(screen.getByTestId("anatomy-issue-ankles")).toBeTruthy();
    expect(screen.getByText("Ankles")).toBeTruthy();
    expect(screen.queryByText("None identified from this recording")).toBeNull();
  });

  it("uses one compact Coach's Note card with separate Scores and Coach's Note views", async () => {
    const screen = await renderResults();

    expect(screen.getByLabelText("Scores").props.accessibilityState).toEqual({ selected: true });
    expect(screen.getByText("Handle Path")).toBeTruthy();
    expect(screen.getByText("Shoulder Level")).toBeTruthy();
    expect(screen.queryByText("Your early repetitions establish a controlled path.")).toBeNull();

    await fireEvent.press(screen.getByLabelText("Coach's Note"));
    expect(screen.getByLabelText("Coach's Note").props.accessibilityState).toEqual({ selected: true });
    expect(screen.getByText(result().coachNote!)).toBeTruthy();
    expect(screen.queryByText("Handle Path")).toBeNull();
    expect(screen.queryByTestId("movement-scores")).toBeNull();
  });

  it("keeps what happened and what to do next bound to the issue selected by the arrows", async () => {
    const screen = await renderResults();

    expect(screen.getByText("Issue 1 of 4")).toBeTruthy();
    expect(screen.getByTestId("coaching-what-happened-detail").props.children).toContain("On rep 1");
    await fireEvent.press(screen.getByLabelText("Why it matters"));
    expect(screen.getByTestId("coaching-why-it-matters-copy").props.children).toBe("The uneven shoulder position tilts the visible weight path.");
    await fireEvent.press(screen.getByLabelText("What to do next"));
    expect(screen.getAllByText("Start the next rep with both shoulders level.").length).toBeGreaterThan(0);
    expect(screen.queryByTestId("coaching-supporting-copy")).toBeNull();

    await fireEvent.press(screen.getByLabelText("Next problem"));
    expect(screen.getByText("Issue 2 of 4")).toBeTruthy();
    expect(screen.getByTestId("coaching-what-happened-detail").props.children).toContain("On rep 1");
    expect(screen.queryByText("Priority 2 affects repeatable movement quality.")).toBeNull();
    await fireEvent.press(screen.getByLabelText("Why it matters"));
    expect(screen.getByTestId("coaching-why-it-matters-copy").props.children).toBe("The uneven shoulder position tilts the visible weight path.");
    await fireEvent.press(screen.getByLabelText("What to do next"));
    expect(screen.getAllByText("Start the next rep with both shoulders level.").length).toBeGreaterThan(0);
  });

  it("renders writer summaries in white and writer details in gray without splitting or recombining them", async () => {
    const value = result();
    value.priorityCorrections[0].title = "Control the late descent";
    value.priorityCorrections[0].expandedCoaching!.whatHappened = "Your lowering speed changes. Keep this as one white summary field.";
    value.priorityCorrections[0].expandedCoaching!.whatHappenedDetail = "The second visible sentence adds the rep moment. The third visible sentence completes the observation.";
    const screen = await renderResults(jest.fn(), value);

    expect(screen.getByTestId("coaching-what-happened-copy").props.children).toBe(value.priorityCorrections[0].expandedCoaching!.whatHappened);
    expect(StyleSheet.flatten(screen.getByTestId("coaching-what-happened-copy").props.style)).toMatchObject({ color: colors.text, fontSize: 15, lineHeight: 22, fontWeight: "700" });
    expect(screen.getByTestId("coaching-what-happened-detail").props.children).toBe(value.priorityCorrections[0].expandedCoaching!.whatHappenedDetail);
    expect(StyleSheet.flatten(screen.getByTestId("coaching-what-happened-detail").props.style)).toMatchObject({ color: colors.textSecondary, fontSize: 15, lineHeight: 22, fontWeight: "400" });

    await fireEvent.press(screen.getByLabelText("Why it matters"));
    expect(screen.getByTestId("coaching-why-it-matters-copy").props.children).toBe("The uneven shoulder position tilts the visible weight path.");
    expect(StyleSheet.flatten(screen.getByTestId("coaching-why-it-matters-copy").props.style)).toMatchObject({ color: colors.text, fontSize: 15, lineHeight: 22, fontWeight: "700" });
    expect(screen.getByTestId("coaching-why-it-matters-detail").props.children).toContain("less repeatable");

    await fireEvent.press(screen.getByLabelText("What to do next"));
    expect(screen.getByTestId("coaching-what-to-do-next").props.children).toBe("Start the next rep with both shoulders level.");
    expect(StyleSheet.flatten(screen.getByTestId("coaching-what-to-do-next").props.style)).toMatchObject({ color: colors.text, fontWeight: "700" });
    expect(screen.queryByTestId("coaching-what-to-do-next-detail")).toBeNull();
  });

  it("uses compact summary and list typography", async () => {
    const screen = await renderResults();
    expect(StyleSheet.flatten(screen.getByTestId("whole-set-summary-text").props.style)).toMatchObject({ fontSize: 16, lineHeight: 23, fontWeight: "400" });
    expect(StyleSheet.flatten(screen.getByTestId("summary-next-plan-1").props.style)).toMatchObject({ fontSize: 16, lineHeight: 23 });
    expect(StyleSheet.flatten(screen.getByTestId("summary-next-plan-1-card").props.style)).toMatchObject({ minHeight: 56 });
  });

  it("shows the longer three-sentence whole-set summary", async () => {
    const value = result();
    value.overallAssessment = "The opening repetitions use a steady pulling path. The right shoulder rises during the later pulls. The final repetitions also return faster than the first.";

    const screen = await renderResults(jest.fn(), value);

    expect(screen.getByTestId("whole-set-summary-text").props.children).toContain("The final repetitions also return faster than the first.");
  });

  it("navigates every returned issue without rendering the redundant issue belt", async () => {
    const screen = await renderResults();

    expect(screen.queryByTestId("all-issues-list")).toBeNull();
    expect(screen.queryByTestId("issue-carousel")).toBeNull();
    expect(screen.queryAllByTestId(/^issue-carousel-card-/)).toHaveLength(0);
    expect(screen.queryByText(/more details/i)).toBeNull();
    await fireEvent.press(screen.getByLabelText("Next problem"));
    expect(screen.getByText("Issue 2 of 4")).toBeTruthy();
    expect(screen.getByTestId("active-coaching-panel").props.accessibilityLabel).toContain("Priority 2");
  });

  it("keeps the final issue panel at a stable phone width", async () => {
    const screen = await renderResults();
    for (let index = 1; index < 4; index += 1) {
      await fireEvent.press(screen.getByLabelText("Next problem"));
    }

    expect(screen.getByText("Issue 4 of 4")).toBeTruthy();
    expect(StyleSheet.flatten(screen.getByTestId("coaching-panel").props.style)).toMatchObject({
      width: "100%",
      minWidth: 0,
    });
    expect(StyleSheet.flatten(screen.getByTestId("active-coaching-panel").props.style)).toMatchObject({
      width: "100%",
    });
  });

  it("explains a current movement score without a legacy scorecard", async () => {
    const value = result();
    value.scoreRationale = [
      { criterion: "setup_stability", observed: "The support base stays planted.", impact: 5, confidence: 0.9, evidenceIds: ["well-0"] },
      { criterion: "path_alignment", observed: "The working shoulder rises at the top.", impact: 25, confidence: 0.9, evidenceIds: ["fix-0"] },
      { criterion: "range_positions", observed: "The endpoints stay visible and repeatable.", impact: 5, confidence: 0.85, evidenceIds: [] },
      { criterion: "control_tempo", observed: "The return becomes faster late in the set.", impact: 20, confidence: 0.88, evidenceIds: ["fix-1"] },
      { criterion: "rep_consistency", observed: "The last repetitions differ from the first.", impact: 20, confidence: 0.88, evidenceIds: ["fix-1"] },
    ];

    const screen = await renderResults(jest.fn(), value);
    expect(screen.queryByText("Why this score")).toBeNull();
    expect(screen.queryByText("The working shoulder rises at the top.")).toBeNull();
    expect(screen.queryByText("The return becomes faster late in the set.")).toBeNull();
  });

  it("always shows the numeric score for a viewable workout", async () => {
    const screen = await renderResults();
    expect(screen.getAllByLabelText("Coach score 75 out of 100")).toHaveLength(1);
    expect(screen.getByTestId("coach-score-gauge")).toBeTruthy();
    expect(screen.queryByText("TECHNIQUE SCORE")).toBeNull();
    expect(screen.queryByText(/low angle showed tempo and elbow path/i)).toBeNull();
    expect(screen.queryByText("High-to-low cable row")).toBeNull();
    expect(screen.getByText("COACHING REVIEW")).toBeTruthy();
  });

  it("keeps evidence review inline and supports another recording", async () => {
    const onRecordAnother = jest.fn();
    const screen = await renderResults(onRecordAnother);
    await fireEvent.press(screen.getAllByText("Priority 1")[0]);
    await fireEvent.press(screen.getByText("Record Another Set"));
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
    unusable.movementScores = [];
    unusable.setSummary = { totalReps: null, consistentReps: null, verdict: null };
    unusable.repTimeline = [];
    unusable.nextSetPlan = [];

    const onRecordAnother = jest.fn();
    const screen = await render(
      <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, right: 0, bottom: 34, left: 0 } }}>
        <ResultsScreen result={unusable} onRecordAnother={onRecordAnother} />
      </SafeAreaProvider>,
    );

    expect(screen.getByText("RECORDING UNUSABLE")).toBeTruthy();
    await fireEvent.press(screen.getByText("Record Again"));
    expect(onRecordAnother).toHaveBeenCalledTimes(1);
  });

  it("turns the result into an evidence-led coaching loop", async () => {
    const screen = await renderResults();

    expect(screen.getByText("COACHING REVIEW")).toBeTruthy();
    expect(screen.getByText("What happened")).toBeTruthy();
    expect(screen.getByText("Why it matters")).toBeTruthy();
    expect(screen.getByText("What to do next")).toBeTruthy();
    expect(screen.queryByText("6 of 8 reps consistent")).toBeNull();
    expect(screen.getByText("WHOLE SET SUMMARY")).toBeTruthy();
    expect(screen.getByText("Issue 1 of 4")).toBeTruthy();
    expect(screen.getByTestId("coaching-what-happened-detail").props.children).toContain("On rep 1");
    await fireEvent.press(screen.getByLabelText("Why it matters"));
    expect(screen.getByTestId("coaching-why-it-matters-detail").props.children).toContain("less repeatable");
    await fireEvent.press(screen.getByLabelText("What to do next"));
    expect(screen.getAllByText("Start the next rep with both shoulders level.").length).toBeGreaterThan(0);
    expect(screen.queryByText(/premium run/i)).toBeNull();
    expect(screen.queryByText(/tokens/)).toBeNull();
    expect(screen.getByText("Ask Formie Coach")).toBeTruthy();
    expect(screen.queryByLabelText(/Coaching point:/)).toBeNull();
    expect(screen.queryByLabelText(/AI focus:/)).toBeNull();
    expect(screen.queryByText(/^Rep \d+$/)).toBeNull();

    await fireEvent.press(screen.getByText("Did well 1"));
  });

  it("keeps clean sets correction-free while preserving strengths", async () => {
    const value = result();
    value.priorityCorrections = [];
    value.coachingCues = [];
    value.nextSetPlan = [];

    const screen = await renderResults(jest.fn(), value);

    expect(screen.getByText("No visible issues found")).toBeTruthy();
    expect(screen.queryByText(/Issue \d+ of/)).toBeNull();
    expect(screen.getByText("Did well 1")).toBeTruthy();
    expect(screen.queryByText("YOUR NEXT SET")).toBeNull();
  });

  it("renders declaration-only guidance without creating a video finding marker", async () => {
    const value = result();
    value.analysisBasis = "declared_only";
    value.viewNotes = ["No visual claim is made for the stored recording."];
    value.generalGuidance = ["Set the phone so the movement stays in view.", "Use a controlled range for the declared amount."];
    value.coachNote = null;
    value.overallAssessment = "The declared set details are available for next-set guidance.";
    value.score = null;
    value.movementScores = [];
    value.didWell = [];
    value.priorityCorrections = [];
    value.coachingCues = [];
    value.nextSetPlan = [];

    const screen = await render(
      <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, right: 0, bottom: 34, left: 0 } }}>
        <ResultsScreen result={value} onRecordAnother={jest.fn()} />
      </SafeAreaProvider>,
    );

    expect(screen.queryByTestId("general-guidance-section")).toBeNull();
    expect(screen.queryByText("DECLARED-SET GUIDANCE")).toBeNull();
    expect(screen.queryByTestId("view-notes-section")).toBeNull();
    expect(screen.queryByText(/Issue \d+ of/)).toBeNull();
    expect(screen.queryByTestId(/timeline-evidence-marker-/)).toBeNull();
  });

  it("uses the selected primary evidence peak for the displayed issue", async () => {
    const value = result();
    value.priorityCorrections[0].primaryEvidenceIndex = 1;

    const screen = await renderResults(jest.fn(), value);

    expect(screen.getByText("reset · 00:01.8")).toBeTruthy();
  });

  it("exposes the tutorial loading, failure, and success actions", async () => {
    const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, right: 0, bottom: 34, left: 0 } };
    const loading = await render(
      <SafeAreaProvider initialMetrics={metrics}>
        <ResultsScreen result={result()} onRecordAnother={jest.fn()} exampleState="loading" />
      </SafeAreaProvider>,
    );
    expect(loading.getByText("Loading Example…")).toBeDisabled();

    const retry = jest.fn();
    const failed = await render(
      <SafeAreaProvider initialMetrics={metrics}>
        <ResultsScreen result={result()} onRecordAnother={jest.fn()} exampleState="error" onWatchExample={retry} />
      </SafeAreaProvider>,
    );
    await fireEvent.press(failed.getByText("Retry Example"));
    expect(retry).toHaveBeenCalledTimes(1);

    const watch = jest.fn();
    const ready = await render(
      <SafeAreaProvider initialMetrics={metrics}>
        <ResultsScreen result={result()} onRecordAnother={jest.fn()} exampleState="ready" onWatchExample={watch} />
      </SafeAreaProvider>,
    );
    await fireEvent.press(ready.getByText("Watch Example"));
    expect(watch).toHaveBeenCalledTimes(1);
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
          onRecordAnother={jest.fn()}
        />
      </SafeAreaProvider>,
    );
    expect(screen.queryByText("Movement tracking")).toBeNull();
    expect(screen.queryByText("MoveNet Thunder")).toBeNull();
  });

  it("shows the declared exercise while hiding the model's inferred label", async () => {
    const screen = await renderResults();
    expect(screen.queryByText("High-to-low cable row")).toBeNull();
    expect(screen.getByText("Dumbbell Bench Press · 8 reps · 40 lb per hand")).toBeTruthy();
    expect(screen.queryByText("Correct exercise name")).toBeNull();
    expect(screen.queryByLabelText("Exercise name")).toBeNull();
  });

  it("removes the standalone setup, equipment, and load section", async () => {
    const screen = await renderResults();

    expect(screen.queryByText("SETUP, EQUIPMENT & LOAD")).toBeNull();
    expect(screen.queryByText("Selected stack load")).toBeNull();
    expect(screen.queryByTestId("equipment-observations-section")).toBeNull();
    expect(screen.getByText(/Dumbbell Bench Press.*8 reps.*40 lb per hand/)).toBeTruthy();
  });

  it("uses Gemini's video-derived muscle focus instead of replacing it with the static catalog", async () => {
    const screen = await renderResults();

    await fireEvent.press(screen.getByLabelText("Target Muscles"));
    expect(screen.getByText("Latissimus dorsi, Upper back")).toBeTruthy();
    expect(screen.getByText("Biceps")).toBeTruthy();
    expect(screen.queryByText("Pectorals")).toBeNull();
  });

  it("labels the audited number as a technique score and explains every strict criterion and cap", async () => {
    const value = result();
    value.score = 59;
    value.scorecard = {
      rubricVersion: "strict-technique-v1",
      coverage: 1,
      confidence: 0.88,
      criteria: [
        { key: "setup_stability", weight: 20, rating: 82, confidence: 0.9, observed: "The setup stays stable.", evidenceIds: ["well-0"] },
        { key: "path_alignment", weight: 25, rating: 58, confidence: 0.88, observed: "The elbow path changes repeatedly.", evidenceIds: ["fix-0"] },
        { key: "range_positions", weight: 20, rating: 65, confidence: 0.86, observed: "Late endpoints shorten.", evidenceIds: ["fix-1"] },
        { key: "control_tempo", weight: 15, rating: 75, confidence: 0.9, observed: "Most lowering phases stay controlled.", evidenceIds: ["well-1"] },
        { key: "rep_consistency", weight: 20, rating: 52, confidence: 0.86, observed: "The last two reps break from the early pattern.", evidenceIds: ["fix-0"] },
      ],
      uncappedScore: 66,
      appliedCap: 59,
      finalScore: 59,
      auditStatus: "confirmed",
    };

    const screen = await renderResults(jest.fn(), value);
    expect(screen.getByLabelText("Coach score 59 out of 100")).toBeTruthy();
    expect(screen.queryByText("Why this score")).toBeNull();
    expect(screen.queryByText("Movement path and alignment")).toBeNull();
    expect(screen.queryByText(/Score capped at 59/)).toBeNull();
    expect(screen.queryByLabelText(/Movement quality/)).toBeNull();
  });

  it("lets a real user analyze the saved video again", async () => {
    const onReanalyze = jest.fn();
    const visible = await render(
      <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, right: 0, bottom: 34, left: 0 } }}>
        <ResultsScreen result={result()} videoUrl="https://storage.example/private-set.mp4" durationMs={12_000} onRecordAnother={jest.fn()} onReanalyze={onReanalyze} />
      </SafeAreaProvider>,
    );
    expect(visible.getByText("Something look wrong?")).toBeTruthy();
    await fireEvent.press(visible.getByText("Analyze Again"));
    expect(onReanalyze).toHaveBeenCalledTimes(1);
  });

  it("locks the reanalysis control while resetting and shows a reset error", async () => {
    const onReanalyze = jest.fn();
    const screen = await render(
      <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, right: 0, bottom: 34, left: 0 } }}>
        <ResultsScreen result={result()} videoUrl="https://storage.example/private-set.mp4" durationMs={12_000} onRecordAnother={jest.fn()} onReanalyze={onReanalyze} reanalyzing reanalysisError="Could not reset this saved video." />
      </SafeAreaProvider>,
    );
    expect(screen.getByText("Analyzing Again…")).toBeTruthy();
    expect(screen.getByText("Could not reset this saved video.")).toBeTruthy();
    await fireEvent.press(screen.getByText("Analyzing Again…"));
    expect(onReanalyze).not.toHaveBeenCalled();
  });
});
