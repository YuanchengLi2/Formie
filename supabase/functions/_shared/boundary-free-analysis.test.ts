import {
  boundaryFreeToCandidate,
  buildBoundaryFreeAnalysisPrompt,
  buildBoundaryFreeRecheckPrompt,
  buildWholeVideoWritingPrompt,
  parseBoundaryFreeAnalysis,
  parseRecheckRequest,
  parseWholeVideoWriting,
  type BoundaryFreeAnalysis,
  type WholeVideoWriting,
} from "./boundary-free-analysis";

const analysis: BoundaryFreeAnalysis = {
  analysisBasis: "observed",
  videoUnderstanding: {
    recordingSummary: "A chest-supported row is visible.",
    exerciseSummary: "The athlete performs a chest-supported dumbbell row.",
    visibleSequence: "Four rows are visible.",
    beginning: "The first row begins from straight arms.",
    middle: "The elbows travel toward the hips.",
    end: "The final dumbbells lower quickly.",
    changesAcrossVideo: "The lowering becomes faster on reps 3 and 4.",
    setupEquipmentAndSurroundings: "The chest stays on an incline bench with two dumbbells.",
    observedRepCount: 4,
    viewNotes: [],
  },
  movementScores: ["path", "range", "tempo", "position"].map((id, index) => ({
    id,
    label: `${id} score`,
    score: 80 - index,
    observed: `${id} is visible during the row.`,
    evidenceIds: ["fast-lowering"],
  })),
  muscleFocus: { primary: [], secondary: [], unclassified: [] },
  coachingItems: [{
    id: "fast-lowering",
    topic: "Fast dumbbell lowering",
    observation: "During reps 3 and 4 of the chest-supported row, both dumbbells drop faster from the ribs to the bottom.",
    whyItMatters: "The faster return changes the row tempo and bottom position compared with the first two reps.",
    correctionDirection: "Lower both dumbbells for two seconds while keeping the chest supported on the bench.",
    severity: "important",
    confidence: 0.93,
    observedIssueRegions: ["upper_back"],
    primaryEvidenceIndex: 0,
    evidence: [{ startMs: 5_000, peakMs: 5_300, endMs: 5_700, visualEvidence: "Both dumbbells drop quickly after reaching the ribs on rep 3.", visibleBodyAreas: ["upper back", "arms", "dumbbells"], confidence: 0.93, repNumber: 3, phase: "lowering" }],
  }],
  strengths: [],
  generalGuidance: [],
  recheckRequest: null,
};

const writing: WholeVideoWriting = {
  overallAssessment: "The chest-supported dumbbell row keeps a stable bench position, but the return speeds up late in the set.",
  coachNote: "Match the controlled opening rows by slowing both dumbbells on the final repetitions.",
  movementScores: analysis.movementScores,
  coachingItems: [{
    id: "fast-lowering",
    title: "Slow the late-row return",
    whatHappened: "On rep 3 of the chest-supported dumbbell row, both dumbbells drop quickly after reaching your ribs. Rep 4 shows the same faster lowering phase compared with the first two rows.",
    whyItMatters: "That speed change makes the bottom position of the chest-supported row less repeatable. It also removes the clear two-part pull-and-return rhythm visible in the opening reps.",
    whatToDo: "Keep your chest on the incline bench and lower both dumbbells for two seconds after each pull.",
    successCheck: "Reps 3 and 4 should match the lowering speed and bottom position of reps 1 and 2.",
  }],
  strengths: [],
};

describe("v53 coaching writer contract", () => {
  it("accepts a usable analysis with no evidence-backed corrections", () => {
    const parsed = parseBoundaryFreeAnalysis({
      videoUnderstanding: {
        recordingSummary: "A controlled bodyweight squat set is visible.",
        exerciseSummary: "The athlete performs bodyweight squats.",
        visibleSequence: "Three complete squats are visible.",
        beginning: "The first squat stays controlled.",
        middle: "The second squat matches the first.",
        end: "The final squat remains steady.",
        changesAcrossVideo: "No meaningful technique breakdown becomes visible.",
        setupEquipmentAndSurroundings: "The athlete uses open floor space without equipment.",
        observedRepCount: 3,
      },
      movementScores: ["path", "range", "tempo", "position"].map((id) => ({
        id,
        label: id,
        score: 92,
        observed: `${id} remains repeatable across the visible squats.`,
        evidenceIds: [],
      })),
      muscleFocus: { primary: [], secondary: [], unclassified: [] },
      coachingItems: [],
      strengths: [],
      evidenceSelections: [],
      recheckRequest: null,
    }, 9_000);

    expect(parsed.coachingItems).toHaveLength(0);
  });

  it("preserves exhaustive whole-set checks without requiring padded corrections", () => {
    const prompt = buildBoundaryFreeAnalysisPrompt(9_000);

    expect(prompt).toContain("stored pixel dimensions rely on rotation metadata");
    expect(prompt).toContain("continuous active-set interval");
    expect(prompt).toContain("equivalent phases near the beginning, middle, and end");
    expect(prompt).toContain("universal path decision gate");
    expect(prompt).toContain("every additional distinct timestamp-backed issue the recording supports");
    expect(prompt).not.toContain("at least four distinct evidence-backed coaching items");
    expect(prompt).not.toContain("Four is a minimum, not a maximum");
    expect(prompt).not.toContain("auditCoverage");
  });

  it("offers sparse optional rechecks without suggesting a movement-specific answer", () => {
    const prompt = buildBoundaryFreeAnalysisPrompt(10_000);

    expect(prompt).toContain("request a recheck only when you genuinely need to see one short moment again");
    expect(prompt).toContain("Do not request a recheck when the full recording already supports a confident decision");
    expect(prompt).not.toMatch(/bench angle|pull toward|spinal rounding|knee cave/i);
  });

  it("parses one requested center and rejects malformed recheck requests", () => {
    expect(parseRecheckRequest({ centerMs: 4_500, reason: "Confirm the exact transition." }, 10_000)).toEqual({
      centerMs: 4_500,
      reason: "Confirm the exact transition.",
    });
    expect(parseRecheckRequest(null, 10_000)).toBeNull();
    expect(() => parseRecheckRequest({ centerMs: 11_000, reason: "Outside the video." }, 10_000)).toThrow(/centerMs/);
    expect(() => parseRecheckRequest({ centerMs: 4_500, reason: "" }, 10_000)).toThrow(/reason/);
  });

  it("builds the next recheck prompt from the latest revision and remaining allowance", () => {
    const prompt = buildBoundaryFreeRecheckPrompt({
      analysis: { ...analysis, videoUnderstanding: { ...analysis.videoUnderstanding, changesAcrossVideo: "Revised after the first recheck." } },
      declaration: undefined,
      request: { centerMs: 5_300, reason: "Confirm whether the visible change repeats." },
      window: { startMs: 4_300, endMs: 6_300 },
      remainingAfterThis: 1,
    });

    expect(prompt).toContain("Revised after the first recheck.");
    expect(prompt).toContain("Confirm whether the visible change repeats.");
    expect(prompt).toContain("4300 ms through 6300 ms");
    expect(prompt).toContain("one optional recheck remains after this one");
    expect(prompt).toContain("request another recheck only if genuine visual uncertainty remains");
  });

  it("asks for exercise-specific sentence ranges and every supported rep moment", () => {
    const prompt = buildWholeVideoWritingPrompt(analysis, {
      exercise: { source: "custom", label: "Chest-supported dumbbell row" },
      amount: { kind: "reps", value: 4, countScope: "total" },
      load: { kind: "unknown" },
      side: "bilateral",
      styles: [],
      focusNote: null,
    });

    expect(prompt).toContain("whatHappened must contain two or three sentences");
    expect(prompt).toContain("Its first sentence is shown as the bold white coaching line");
    expect(prompt).toContain("whyItMatters must contain two or three sentences");
    expect(prompt).toContain("whatToDo must be exactly one complete actionable sentence");
    expect(prompt).toContain("Name the declared exercise");
    expect(prompt).toContain("reference every numbered repetition supported by the supplied evidence");
    expect(prompt).not.toContain("Mention a numbered repetition at most once");
    expect(prompt).toContain("title is only the concise issue label used for navigation");
    expect(prompt).toContain("it is not the white coaching sentence");
  });

  it("preserves Flash-Lite's concise impactful headline instead of deriving it from the paragraph", () => {
    const parsed = parseWholeVideoWriting(writing, analysis);
    expect(parsed.coachingItems[0].title).toBe("Slow the late-row return");
  });

  it("falls back from a multiline or long writer headline to the analyst topic", () => {
    const multiline = parseWholeVideoWriting({
      ...writing,
      coachingItems: [{ ...writing.coachingItems[0], title: "Slow the return\nKeep the dumbbells controlled" }],
    }, analysis);
    expect(multiline.coachingItems[0].title).toBe(analysis.coachingItems[0].topic);

    const long = parseWholeVideoWriting({
      ...writing,
      coachingItems: [{ ...writing.coachingItems[0], title: "Keep both dumbbells moving through the entire lowering phase with exactly the same controlled speed on every repetition" }],
    }, analysis);
    expect(long.coachingItems[0].title).toBe(analysis.coachingItems[0].topic);
  });

  it("preserves complete technical and exercise-specific coaching without generic rewriting", () => {
    const candidate = boundaryFreeToCandidate(analysis, undefined, {}, writing);
    const finding = candidate.priorityCorrections[0];

    expect(finding.expandedCoaching).toMatchObject({
      whatHappened: writing.coachingItems[0].whatHappened,
      whyItMatters: writing.coachingItems[0].whyItMatters,
      whatToDo: writing.coachingItems[0].whatToDo,
      successCheck: writing.coachingItems[0].successCheck,
    });
    expect(finding.actionableCorrection?.instruction).toBe(writing.coachingItems[0].whatToDo);
  });

  it("falls back per field when writer coaching is awkward or malformed", () => {
    const raw = {
      ...writing,
      coachingItems: [{ ...writing.coachingItems[0], whatHappened: "Only one sentence about the row." }],
    };

    expect(parseWholeVideoWriting(raw, analysis).coachingItems[0].whatHappened).toBe(analysis.coachingItems[0].observation);
    expect(parseWholeVideoWriting({
      ...writing,
      coachingItems: [{ ...writing.coachingItems[0], whyItMatters: "Only one sentence explains why the row changes." }],
    }, analysis).coachingItems[0].whyItMatters).toBe(analysis.coachingItems[0].whyItMatters);
    expect(parseWholeVideoWriting({
      ...writing,
      coachingItems: [{ ...writing.coachingItems[0], whatToDo: "Lower both dumbbells for two seconds. Begin only after your arms reach the bottom." }],
    }, analysis).coachingItems[0].whatToDo).toBe(analysis.coachingItems[0].correctionDirection);
  });

  it("creates analyst-derived copy when the writer response is unavailable", () => {
    const parsed = parseWholeVideoWriting(null, analysis);

    expect(parsed.coachingItems[0]).toMatchObject({
      id: analysis.coachingItems[0].id,
      title: analysis.coachingItems[0].topic,
      whatHappened: analysis.coachingItems[0].observation,
      whyItMatters: analysis.coachingItems[0].whyItMatters,
      whatToDo: analysis.coachingItems[0].correctionDirection,
    });
  });
});
