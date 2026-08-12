import {
  boundaryFreeToCandidate,
  buildBoundaryFreeAnalysisPrompt,
  buildBoundaryFreeRecheckPrompt,
  buildWholeVideoWritingPrompt,
  BOUNDARY_FREE_ANALYSIS_SCHEMA,
  parseBoundaryFreeAnalysis,
  parseRequiredWholeVideoWriting,
  parseRecheckRequest,
  parseWholeVideoWriting,
  normalizeWholeVideoWriting,
  WHOLE_VIDEO_WRITER_SYSTEM_INSTRUCTION,
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
    repAudit: [
      { repNumber: 1, startMs: 500, peakMs: 1_200, endMs: 2_000, visualSummary: "The first row begins with both arms extended below the bench." },
      { repNumber: 2, startMs: 2_100, peakMs: 3_000, endMs: 3_900, visualSummary: "The second row reaches the ribs with the chest supported." },
      { repNumber: 3, startMs: 4_000, peakMs: 5_300, endMs: 5_900, visualSummary: "The third row returns both dumbbells quickly below the bench." },
      { repNumber: 4, startMs: 6_000, peakMs: 7_000, endMs: 8_000, visualSummary: "The final row repeats the faster dumbbell return." },
    ],
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
    observation: "Both dumbbells return faster during the final chest-supported rows.",
    observationDetails: "Rep 3 drops faster from the ribs to the bottom. Rep 4 repeats that faster lowering phase. The opening two repetitions lower more slowly.",
    whyItMatters: "The faster return changes the visible row tempo and bottom position.",
    whyDetails: "The late repetitions no longer match the opening pull-and-return rhythm. That makes their path less repeatable.",
    correctionDirection: "Lower both dumbbells for two seconds while keeping the chest supported on the bench.",
    cue: "Own the way down.",
    successCheck: "The final rows should match the first row's lowering speed and bottom position.",
    affectedRepNumbers: [3, 4],
    severity: "important",
    confidence: 0.93,
    observedIssueRegions: ["upper_back"],
    primaryEvidenceIndex: 0,
    evidence: [
      { startMs: 5_000, peakMs: 5_300, endMs: 5_700, visualEvidence: "Both dumbbells drop quickly after reaching the ribs on rep 3.", visibleBodyAreas: ["upper back", "arms", "dumbbells"], confidence: 0.93, repNumber: 3, phase: "lowering" },
      { startMs: 6_600, peakMs: 7_000, endMs: 7_500, visualEvidence: "Both dumbbells repeat the faster return on rep 4.", visibleBodyAreas: ["upper back", "arms", "dumbbells"], confidence: 0.91, repNumber: 4, phase: "lowering" },
    ],
  }],
  strengths: [],
  generalGuidance: [],
  recheckRequest: null,
};

const writing: WholeVideoWriting = {
  overallAssessment: "The chest-supported dumbbell row keeps a stable bench position. The return speeds up late in the set. Slower lowering is the clearest priority for the next set.",
  coachNote: "The opening rows use a controlled dumbbell return. The faster late return makes the bottom position less repeatable. Lower both dumbbells for two seconds after each pull.",
  movementScores: analysis.movementScores,
  coachingItems: [{
    id: "fast-lowering",
    title: "Slow the late-row return",
    whatHappened: "Both dumbbells return faster during the final chest-supported rows.",
    whatHappenedDetail: "Rep 3 drops quickly after reaching your ribs. Rep 4 repeats the faster lowering phase. The first two rows return more slowly.",
    whyItMatters: "That speed change makes the bottom position less repeatable.",
    whyItMattersDetail: "The final repetitions no longer match the opening pull-and-return rhythm. Their bottom position also becomes less repeatable.",
    whatToDo: "Keep your chest on the incline bench and lower both dumbbells for two seconds after each pull.",
    successCheck: "Reps 3 and 4 should match the lowering speed and bottom position of reps 1 and 2.",
  }],
  strengths: [],
};

describe("v63 full-video rep-audited coaching contract", () => {
  const rawAnalysis = (count: number) => {
    const coachingItems = Array.from({ length: count }, (_, index) => ({
      id: `finding-${index + 1}`,
      topic: `Visible squat issue ${index + 1}`,
      observation: `A distinct visible squat relationship changes for issue ${index + 1}.`,
      observationDetails: `The cited frame shows where issue ${index + 1} appears. The comparison uses the matching phase from the audited repetitions. The final sentence explains where the visible change is clearest.`,
      whyItMatters: `Issue ${index + 1} changes the squat path at the cited phase.`,
      whyDetails: `That visible difference makes the position less repeatable across the recorded set. The next repetition no longer matches the earlier path.`,
      correctionDirection: `Keep the cited body or equipment landmark aligned during the bottom phase of the next squat.`,
      cue: `Hold issue ${index + 1} steady.`,
      successCheck: `The next repetition should keep issue ${index + 1} aligned through the bottom.`,
      affectedRepNumbers: [index % 3 + 1],
      severity: "important",
      confidence: 0.9,
      observedIssueRegions: ["knees"],
    }));
    return {
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
        repAudit: [
          { repNumber: 1, startMs: 800, peakMs: 1_200, endMs: 1_700, visualSummary: "The first squat descends and returns to standing." },
          { repNumber: 2, startMs: 2_400, peakMs: 3_200, endMs: 4_000, visualSummary: "The second squat reaches its visible bottom position." },
          { repNumber: 3, startMs: 4_800, peakMs: 5_800, endMs: 6_800, visualSummary: "The final squat returns to standing." },
        ],
      },
      movementScores: ["path", "range", "tempo", "position"].map((id) => ({
        id,
        label: id,
        score: 92,
        observed: `${id} remains repeatable across the visible squats.`,
        evidenceIds: [],
      })),
      muscleFocus: { primary: [], secondary: [], unclassified: [] },
      coachingItems,
      strengths: [],
      evidenceSelections: coachingItems.map((item, index) => ({
        findingId: item.id,
        primaryEvidenceIndex: 0,
        moments: [{ startMs: 1_000 + index * 1_000, peakMs: 1_200 + index * 1_000, endMs: 1_400 + index * 1_000, visualEvidence: `The distinct relationship for ${item.id} is visible.`, visibleBodyAreas: ["knees"], confidence: 0.9, repNumber: index % 3 + 1, phase: "bottom" }],
      })),
      recheckRequest: null,
    };
  };

  const v56RawAnalysis = () => {
    const raw = rawAnalysis(4) as ReturnType<typeof rawAnalysis> & {
      videoUnderstanding: ReturnType<typeof rawAnalysis>["videoUnderstanding"] & {
        repAudit?: Array<{ repNumber: number; startMs: number; peakMs: number; endMs: number; visualSummary: string }>;
      };
    };
    delete (raw.videoUnderstanding as { coverageCheckpoints?: unknown }).coverageCheckpoints;
    raw.videoUnderstanding.repAudit = [
      { repNumber: 1, startMs: 900, peakMs: 1_800, endMs: 2_500, visualSummary: "Rep 1 descends and returns to standing with the feet planted." },
      { repNumber: 2, startMs: 3_000, peakMs: 4_000, endMs: 4_800, visualSummary: "Rep 2 repeats the squat while the torso shifts farther forward." },
      { repNumber: 3, startMs: 5_200, peakMs: 6_200, endMs: 7_100, visualSummary: "Rep 3 returns to standing after the same forward torso shift." },
    ];
    raw.coachingItems = raw.coachingItems.map((item, index) => ({
      ...item,
      observation: `The visible relationship for issue ${index + 1} changes during the cited squat repetition.`,
      observationDetails: `The supporting frame shows where issue ${index + 1} appears. The comparison with the other audited repetitions shows whether it repeats. The final sentence identifies the clearest visible change.`,
      whyItMatters: `Issue ${index + 1} changes the visible squat path at the cited phase.`,
      whyDetails: "That difference makes the position less repeatable across the recorded set. The next repetition no longer follows the earlier path.",
      affectedRepNumbers: [index < 3 ? index + 1 : 1],
    }));
    raw.evidenceSelections = raw.evidenceSelections.map((selection, index) => ({
      ...selection,
      moments: selection.moments.map((moment) => ({ ...moment, repNumber: index < 3 ? index + 1 : 1 })),
    }));
    return raw;
  };

  it("accepts four split-copy issues after auditing every visible repetition", () => {
    const parsed = parseBoundaryFreeAnalysis(v56RawAnalysis(), 9_000);

    expect(parsed.videoUnderstanding.repAudit).toHaveLength(3);
    expect(parsed.videoUnderstanding.repAudit.map((rep) => rep.repNumber)).toEqual([1, 2, 3]);
    expect(parsed.coachingItems).toHaveLength(4);
    expect(parsed.coachingItems[0]).toMatchObject({
      observation: "The visible relationship for issue 1 changes during the cited squat repetition.",
      observationDetails: expect.stringContaining("supporting frame"),
      whyItMatters: "Issue 1 changes the visible squat path at the cited phase.",
      whyDetails: expect.stringContaining("less repeatable"),
      affectedRepNumbers: [1],
    });
  });

  it("derives redundant presentation fields from the compact provider response", () => {
    const raw = v56RawAnalysis() as any;
    delete raw.videoUnderstanding.beginning;
    delete raw.videoUnderstanding.middle;
    delete raw.videoUnderstanding.end;
    delete raw.strengths;
    delete raw.recheckRequest;

    const parsed = parseBoundaryFreeAnalysis(raw, 9_000);

    expect(parsed.videoUnderstanding.beginning).toBe(raw.videoUnderstanding.repAudit[0].visualSummary);
    expect(parsed.videoUnderstanding.middle).toBe(raw.videoUnderstanding.repAudit[1].visualSummary);
    expect(parsed.videoUnderstanding.end).toBe(raw.videoUnderstanding.repAudit[2].visualSummary);
    expect(parsed.strengths).toEqual([]);
    expect(parsed.recheckRequest).toBeNull();
    expect(parsed.coachingItems.every((item) => item.observedIssueRegions.length > 0)).toBe(true);
  });

  it("uses the proven Gemini-compatible coaching schema while retaining the local six-item cap", () => {
    const schema = BOUNDARY_FREE_ANALYSIS_SCHEMA as any;
    const coachingItem = schema.properties.coachingItems.items;

    expect(schema.properties.videoUnderstanding.properties.repAudit).toBeDefined();
    expect(coachingItem.properties).toEqual(expect.objectContaining({
      observationDetails: { type: "string" },
      whyDetails: { type: "string" },
      affectedRepNumbers: expect.objectContaining({ type: "array" }),
    }));
    expect(schema.properties.coachingItems.minItems).toBe(4);
    expect(schema.properties.coachingItems.maxItems).toBeUndefined();
    expect(coachingItem.type).toBe("object");
    expect(coachingItem).not.toHaveProperty("anyOf");
    expect(schema.properties.videoUnderstanding.properties).not.toHaveProperty("beginning");
    expect(schema.properties.videoUnderstanding.properties).not.toHaveProperty("middle");
    expect(schema.properties.videoUnderstanding.properties).not.toHaveProperty("end");
    expect(schema.properties).not.toHaveProperty("strengths");
    expect(schema.properties).not.toHaveProperty("recheckRequest");
    expect(coachingItem.required).toContain("observedIssueRegions");
    expect(coachingItem.properties.observedIssueRegions).toEqual({
      type: "array",
      maxItems: 8,
      items: { type: "string", enum: expect.arrayContaining(["ankles", "knees", "torso"]) },
    });
  });

  it("removes a claimed repetition that has no matching evidence moment", () => {
    const raw = v56RawAnalysis();
    raw.coachingItems[0].affectedRepNumbers = [1, 3];

    expect(parseBoundaryFreeAnalysis(raw, 9_000).coachingItems[0].affectedRepNumbers).toEqual([1]);
  });

  it("drops a finding with malformed evidence instead of manufacturing evidence from the rep audit", () => {
    const raw = rawAnalysis(5);
    raw.evidenceSelections[0].moments = [];

    const parsed = parseBoundaryFreeAnalysis(raw, 9_000);

    expect(parsed.coachingItems).toHaveLength(4);
    expect(parsed.coachingItems.map((item) => item.id)).not.toContain("finding-1");
  });

  it("returns four to six ranked issues without rejecting a longer usable response", () => {
    expect(parseBoundaryFreeAnalysis(rawAnalysis(5), 9_000).coachingItems).toHaveLength(5);
    expect(parseBoundaryFreeAnalysis(rawAnalysis(6), 9_000).coachingItems).toHaveLength(6);
    expect(parseBoundaryFreeAnalysis(rawAnalysis(7), 9_000).coachingItems).toHaveLength(6);
  });

  it("discards a malformed early item before applying the six-finding cap", () => {
    const raw = rawAnalysis(7);
    raw.coachingItems[0] = { id: "broken", topic: "" } as never;

    const parsed = parseBoundaryFreeAnalysis(raw, 9_000);

    expect(parsed.coachingItems).toHaveLength(6);
    expect(parsed.coachingItems.map((item) => item.id)).not.toContain("broken");
  });

  it("replaces unsupported physiology in explanations without discarding visible issues", () => {
    const raw = v56RawAnalysis();
    raw.coachingItems[0].whyItMatters = "Partial depth limits full lower-body muscle activation.";
    raw.coachingItems[0].whyDetails = "Greater depth optimizes quadriceps and glute development.";
    raw.coachingItems[1].whyItMatters = "This position increases joint stress.";
    raw.coachingItems[1].whyDetails = "The change reduces muscular tension and power production.";

    const parsed = parseBoundaryFreeAnalysis(raw, 9_000);

    expect(parsed.coachingItems).toHaveLength(4);
    expect(parsed.coachingItems[0].whyItMatters).not.toMatch(/activation|development/i);
    expect(parsed.coachingItems[0].whyDetails).not.toMatch(/activation|development/i);
    expect(parsed.coachingItems[1].whyItMatters).not.toMatch(/joint stress|tension|power production/i);
    expect(parsed.coachingItems[1].whyDetails).not.toMatch(/joint stress|tension|power production/i);
    expect(parsed.coachingItems[0].observation).toBe(raw.coachingItems[0].observation);
  });

  it("replaces muscular tension wording even when no other unsupported phrase is present", () => {
    const raw = v56RawAnalysis();
    raw.coachingItems[3].whyItMatters = "Rapid turnaround reduces muscular tension at the deep position.";

    const parsed = parseBoundaryFreeAnalysis(raw, 9_000);

    expect(parsed.coachingItems).toHaveLength(4);
    expect(parsed.coachingItems[3].whyItMatters).not.toMatch(/muscular tension/i);
    expect(parsed.coachingItems[3].whyItMatters).toMatch(/visible|timing|controlled|repeatable/i);
  });

  it("accepts four distinct evidence-backed coaching findings", () => {
    const parsed = parseBoundaryFreeAnalysis(rawAnalysis(4), 9_000);

    expect(parsed.coachingItems).toHaveLength(4);
  });

  it("restores the original confidence floor for both findings and their visible evidence", () => {
    const lowFinding = rawAnalysis(4);
    lowFinding.coachingItems[0].confidence = 0.74;
    expect(() => parseBoundaryFreeAnalysis(lowFinding, 9_000)).toThrow(/at least four distinct evidence-backed/i);

    const lowEvidence = rawAnalysis(5);
    lowEvidence.evidenceSelections[0].moments[0].confidence = 0.74;
    const parsed = parseBoundaryFreeAnalysis(lowEvidence, 9_000);
    expect(parsed.coachingItems).toHaveLength(4);
    expect(parsed.coachingItems.map((item) => item.id)).not.toContain("finding-1");
  });

  it("spreads displayed primary evidence across the valid moments in the set", () => {
    const raw = v56RawAnalysis();
    const sharedMoments = [
      { startMs: 1_400, peakMs: 1_800, endMs: 2_200, visualEvidence: "The issue is visible on rep 1.", visibleBodyAreas: ["knees"], confidence: 0.94, repNumber: 1, phase: "bottom" },
      { startMs: 3_600, peakMs: 4_000, endMs: 4_400, visualEvidence: "The issue is visible on rep 2.", visibleBodyAreas: ["knees"], confidence: 0.92, repNumber: 2, phase: "bottom" },
      { startMs: 5_800, peakMs: 6_200, endMs: 6_600, visualEvidence: "The issue is visible on rep 3.", visibleBodyAreas: ["knees"], confidence: 0.9, repNumber: 3, phase: "bottom" },
    ];
    raw.coachingItems = raw.coachingItems.map((item) => ({ ...item, affectedRepNumbers: [1, 2, 3] }));
    raw.evidenceSelections = raw.evidenceSelections.map((selection) => ({
      ...selection,
      primaryEvidenceIndex: 0,
      moments: sharedMoments.map((moment) => ({ ...moment })),
    }));

    const parsed = parseBoundaryFreeAnalysis(raw, 9_000);
    const displayedPeaks = parsed.coachingItems.map((item) => item.evidence[item.primaryEvidenceIndex ?? 0].peakMs);

    expect(displayedPeaks).toEqual([1_800, 4_000, 6_200, 1_800]);
    expect(new Set(displayedPeaks.slice(0, 3)).size).toBe(3);
  });

  it("rejects a result with fewer than four real coaching findings", () => {
    expect(() => parseBoundaryFreeAnalysis(rawAnalysis(3), 9_000)).toThrow(/at least four distinct evidence-backed/i);
  });

  it("preserves natural coaching within the original sentence ranges instead of truncating each field", () => {
    const raw = rawAnalysis(4);
    raw.coachingItems[3].observation = "Your left knee moves inward near the bottom. It returns over your foot as you stand.";
    raw.coachingItems[3].observationDetails = "The change is clearest on the final squat.";
    raw.coachingItems[3].whyItMatters = "That inward shift changes your balance. It also changes the path back to standing.";
    raw.coachingItems[3].whyDetails = "The last squat no longer follows the opening path.";
    raw.coachingItems[3].correctionDirection = "Keep your knee over the middle of your foot. Match that path as you stand.";

    const parsed = parseBoundaryFreeAnalysis(raw, 9_000);

    expect(parsed.coachingItems).toHaveLength(4);
    expect(parsed.coachingItems[3].observation).toBe(raw.coachingItems[3].observation);
    expect(parsed.coachingItems[3].observationDetails).toBe(raw.coachingItems[3].observationDetails);
    expect(parsed.coachingItems[3].whyItMatters).toBe(raw.coachingItems[3].whyItMatters);
    expect(parsed.coachingItems[3].whyDetails).toBe(raw.coachingItems[3].whyDetails);
    expect(parsed.coachingItems[3].correctionDirection).toBe(raw.coachingItems[3].correctionDirection);
  });

  it("restores the July full-set inspection checklist while retaining four to six evidence-backed findings", () => {
    const prompt = buildBoundaryFreeAnalysisPrompt(9_000);

    expect(prompt).toContain("Watch the complete original recording");
    expect(prompt).toContain("beginning, middle, and end");
    expect(prompt).toContain("stance, posture, torso position, balance, grip, support points, and equipment motion");
    expect(prompt).toContain("setup, load, equipment, safety or surroundings, grip or contact, and support or balance");
    expect(prompt).toContain("intended visible endpoint relationship");
    expect(prompt).toContain("actions before the first real rep and after the last real rep");
    expect(prompt).toContain("Return four to six distinct evidence-backed issues");
    expect(prompt).toContain("Never invent a deviation");
  });

  it("rejects an analysis that does not audit every observed repetition", () => {
    const missing = rawAnalysis(4);
    delete (missing.videoUnderstanding as { repAudit?: unknown }).repAudit;
    expect(() => parseBoundaryFreeAnalysis(missing, 9_000)).toThrow(/repAudit/i);

    const concentrated = rawAnalysis(4);
    concentrated.videoUnderstanding.repAudit = concentrated.videoUnderstanding.repAudit.slice(0, 2);
    expect(() => parseBoundaryFreeAnalysis(concentrated, 9_000)).toThrow(/every observed repetition/i);
  });

  it("keeps the one whole-video pass focused on evidence for the separate writer", () => {
    const prompt = buildBoundaryFreeAnalysisPrompt(10_000);

    expect(prompt).toContain("You do not write the user-facing coaching");
    expect(prompt).not.toContain("analyst and coaching writer");
    expect(prompt).toContain("Return the evidence-backed analyst record, not polished user-facing prose");
    expect(prompt).toContain("A separate text-only coaching writer will receive these validated facts");
    expect(prompt).not.toContain("white bold summary");
    expect(prompt).not.toContain("smaller gray detail");
    expect(prompt).toContain("Always set recheckRequest to null");
    expect(prompt).not.toContain("Keep each coaching sentence under 18 words");
    expect(prompt).not.toContain("request a recheck only when");
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

  it("asks for exercise-specific coaching without turning every finding into a repetition log", () => {
    const prompt = buildWholeVideoWritingPrompt(analysis, {
      exercise: { source: "custom", label: "Chest-supported dumbbell row" },
      amount: { kind: "reps", value: 4, countScope: "total" },
      load: { kind: "unknown" },
      side: "bilateral",
      styles: [],
      focusNote: null,
    });

    expect(prompt).not.toContain("You are Formie's coaching editor");
    expect(prompt).toContain("Validated analysis:");
    expect(prompt).not.toMatch(/"(?:start|peak|end)(?:Ms|Seconds)"/);
    expect(prompt).toContain('"repNumber":3');
    expect(prompt).toContain('"phase":"lowering"');
    expect(WHOLE_VIDEO_WRITER_SYSTEM_INSTRUCTION).toContain("What happened detail must contain two to three sentences");
    expect(WHOLE_VIDEO_WRITER_SYSTEM_INSTRUCTION).toContain("Why it matters detail must contain two to three sentences");
    expect(WHOLE_VIDEO_WRITER_SYSTEM_INSTRUCTION).toContain("What to do next has no gray detail field");
    expect(WHOLE_VIDEO_WRITER_SYSTEM_INSTRUCTION).toContain("white summaries must each contain exactly one sentence");
    expect(WHOLE_VIDEO_WRITER_SYSTEM_INSTRUCTION).not.toContain("Keep each sentence under 18 words");
    expect(WHOLE_VIDEO_WRITER_SYSTEM_INSTRUCTION).toContain("coachNote must contain exactly three sentences");
    expect(WHOLE_VIDEO_WRITER_SYSTEM_INSTRUCTION).toContain("overallAssessment must contain three to four sentences");
    expect(WHOLE_VIDEO_WRITER_SYSTEM_INSTRUCTION).toContain("helpful trainer talking to a person at the gym");
    expect(WHOLE_VIDEO_WRITER_SYSTEM_INSTRUCTION).toContain("beginner can understand on the first read");
    expect(WHOLE_VIDEO_WRITER_SYSTEM_INSTRUCTION).toContain("actual exercise, equipment or handle, familiar body part");
    expect(WHOLE_VIDEO_WRITER_SYSTEM_INSTRUCTION).toContain("Do not turn the detail into a chronological rep log");
    expect(WHOLE_VIDEO_WRITER_SYSTEM_INSTRUCTION).toContain("title is only the concise issue label used for navigation");
    expect(WHOLE_VIDEO_WRITER_SYSTEM_INSTRUCTION).toContain("it is not the white coaching sentence");
    expect(WHOLE_VIDEO_WRITER_SYSTEM_INSTRUCTION).toContain("white bold summary");
    expect(WHOLE_VIDEO_WRITER_SYSTEM_INSTRUCTION).toContain("smaller gray detail");
    expect(WHOLE_VIDEO_WRITER_SYSTEM_INSTRUCTION).toContain("What happened detail must contain two to three sentences");
    expect(WHOLE_VIDEO_WRITER_SYSTEM_INSTRUCTION).toContain("Why it matters detail must contain two to three sentences");
    expect(WHOLE_VIDEO_WRITER_SYSTEM_INSTRUCTION).toContain("What to do next has no gray detail field");
  });

  it("requires complete writer copy instead of exposing rough analyst prose", () => {
    expect(() => parseRequiredWholeVideoWriting(null, analysis)).toThrow("writer response must be an object");
    const requiredItems = writing.coachingItems.map(({ successCheck: _successCheck, ...item }) => item);
    expect(() => parseRequiredWholeVideoWriting({
      ...writing,
      coachingItems: [{
        ...requiredItems[0],
        whyItMattersDetail: "Full contraction ensures optimal muscle engagement.",
      }],
    }, analysis)).toThrow("unsupported coaching language");
  });

  it("reports every invalid writer field in one repair request", () => {
    const requiredWriting = {
      ...writing,
      overallAssessment: "Your set loses upper back engagement. The lowering changes. Keep the next set steady.",
      coachingItems: writing.coachingItems.map(({ successCheck: _successCheck, ...item }, index) => index === 0
        ? {
          ...item,
          whatHappenedDetail: "Your neck reaches hyperextension at peak contraction. This is clearest late in the set.",
          whyItMattersDetail: "Full contraction ensures optimal muscle engagement.",
        }
        : item),
    };

    expect(() => parseRequiredWholeVideoWriting(requiredWriting, analysis)).toThrow(
      /overallAssessment[\s\S]*coachingItems\[0\]\.whatHappenedDetail[\s\S]*coachingItems\[0\]\.whyItMattersDetail/,
    );
  });

  it("normalizes a rejected repair into publishable coaching instead of failing analysis", () => {
    const rejectedRepair = {
      ...writing,
      overallAssessment: "Your set loses upper back engagement. The lowering changes. Keep the next set steady.",
      coachingItems: writing.coachingItems.map(({ successCheck: _successCheck, ...item }, index) => index === 0
        ? {
          ...item,
          whatHappened: "Your cervical spine reaches hyperextension at peak contraction.",
          whatHappenedDetail: "Your neck tips back during the concentric phase.",
          whyItMattersDetail: "Full scapular retraction improves muscle engagement.",
          whatToDo: "Keep your sternum on the pad through the eccentric phase.",
        }
        : item),
    };

    const normalized = normalizeWholeVideoWriting(rejectedRepair, analysis);
    const sentenceTotal = (value: string) => value.match(/[.!?](?:\s|$)/g)?.length ?? 1;

    expect(sentenceTotal(normalized.coachingItems[0].whatHappened)).toBe(1);
    expect(sentenceTotal(normalized.coachingItems[0].whatHappenedDetail ?? "")).toBeGreaterThanOrEqual(2);
    expect(sentenceTotal(normalized.coachingItems[0].whyItMattersDetail ?? "")).toBeGreaterThanOrEqual(2);
    expect(sentenceTotal(normalized.coachingItems[0].whatToDo)).toBe(1);
    expect(normalized.coachingItems[0].successCheck).toBeNull();
    expect(JSON.stringify(normalized)).not.toMatch(/engagement|contraction|cervical|hyperextension|scapular|sternum|concentric|eccentric/i);
  });

  it("enforces one white summary and the requested gray-detail sentence ranges", () => {
    const requiredWriting = {
      ...writing,
      coachingItems: writing.coachingItems.map(({ successCheck: _successCheck, ...item }) => item),
    };
    const valid = parseRequiredWholeVideoWriting(requiredWriting, analysis);
    expect(valid.coachingItems[0]).toMatchObject({
      whatHappened: writing.coachingItems[0].whatHappened,
      whatHappenedDetail: writing.coachingItems[0].whatHappenedDetail,
      whyItMatters: writing.coachingItems[0].whyItMatters,
      whyItMattersDetail: writing.coachingItems[0].whyItMattersDetail,
      whatToDo: writing.coachingItems[0].whatToDo,
      successCheck: null,
    });
    expect(() => parseRequiredWholeVideoWriting({
      ...requiredWriting,
      coachingItems: [{ ...requiredWriting.coachingItems[0], whatHappened: "Your lowering speeds up. It changes late." }],
    }, analysis)).toThrow("whatHappened must contain exactly one sentence");
    expect(() => parseRequiredWholeVideoWriting({
      ...requiredWriting,
      coachingItems: [{ ...requiredWriting.coachingItems[0], whyItMattersDetail: "The last rows are harder to match." }],
    }, analysis)).toThrow("whyItMattersDetail must contain 2 to 3 sentences");
    expect(() => parseRequiredWholeVideoWriting({
      ...requiredWriting,
      coachingItems: [{ ...requiredWriting.coachingItems[0], whatHappenedDetail: "Only one gray sentence." }],
    }, analysis)).toThrow("whatHappenedDetail must contain 2 to 3 sentences");
    expect(() => parseRequiredWholeVideoWriting({
      ...requiredWriting,
      coachingItems: [{ ...requiredWriting.coachingItems[0], successCheck: "Do not return gray next-step copy." }],
    }, analysis)).toThrow("successCheck must not be returned");
  });

  it("converts leaked millisecond timestamps to readable seconds without rejecting the writing", () => {
    const parsed = parseWholeVideoWriting({
      ...writing,
      overallAssessment: "The row stays controlled early. The return changes at 3250ms. Slow the final lowering phase.",
      coachingItems: [{
        ...writing.coachingItems[0],
        whatHappened: "Both dumbbells begin dropping faster at 3250ms.",
        whatHappenedDetail: "The change starts around 3,250 milliseconds. Rep 3 then drops quickly. Rep 4 repeats the faster return.",
      }],
    }, analysis);

    expect(parsed.overallAssessment).toContain("3.3 seconds");
    expect(parsed.coachingItems[0].whatHappened).toContain("3.3 seconds");
    expect(parsed.coachingItems[0].whatHappenedDetail).toContain("3.3 seconds");
    expect(JSON.stringify(parsed)).not.toMatch(/milliseconds|\d[\d,]*\s*ms\b/i);
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
      whatHappenedDetail: writing.coachingItems[0].whatHappenedDetail,
      whyItMatters: writing.coachingItems[0].whyItMatters,
      whyItMattersDetail: writing.coachingItems[0].whyItMattersDetail,
      whatToDo: writing.coachingItems[0].whatToDo,
      successCheck: writing.coachingItems[0].successCheck,
    });
    expect(finding.actionableCorrection?.instruction).toBe(writing.coachingItems[0].whatToDo);
  });

  it("uses the analyst's original correction, cue, and visible success check without a writer template", () => {
    const candidate = boundaryFreeToCandidate(analysis, undefined, {}, parseWholeVideoWriting(null, analysis));
    const finding = candidate.priorityCorrections[0];

    expect(finding.correction).toBe("Lower both dumbbells for two seconds while keeping the chest supported on the bench.");
    expect(finding.cue).toBe("Own the way down.");
    expect(finding.actionableCorrection?.successCheck).toBe("The final rows should match the first row's lowering speed and bottom position.");
  });

  it("recovers a legacy finding's issue regions from its own visible evidence", () => {
    const legacy = {
      ...analysis,
      coachingItems: [{
        ...analysis.coachingItems[0],
        observedIssueRegions: [],
        evidence: analysis.coachingItems[0].evidence.map((moment) => ({
          ...moment,
          visibleBodyAreas: ["feet", "ankles", "floor"],
        })),
      }],
    };

    expect(boundaryFreeToCandidate(legacy).priorityCorrections[0].observedIssueRegions).toEqual(["ankles"]);
  });

  it("recovers issue regions from side-qualified compound evidence labels", () => {
    const legacy = {
      ...analysis,
      coachingItems: [{
        ...analysis.coachingItems[0],
        observedIssueRegions: [],
        evidence: analysis.coachingItems[0].evidence.map((moment) => ({
          ...moment,
          visibleBodyAreas: ["left foot and ankle", "right shoulder blade"],
        })),
      }],
    };

    expect(boundaryFreeToCandidate(legacy).priorityCorrections[0].observedIssueRegions).toEqual(["ankles", "upper_back"]);
  });

  it("does not truncate natural coaching when a response goes beyond the recommended range", () => {
    const parsed = parseWholeVideoWriting({
      ...writing,
      coachingItems: [{
        ...writing.coachingItems[0],
        whatHappenedDetail: "Rep 3 drops quickly after reaching your ribs. Rep 4 repeats the faster lowering phase. The first two rows return more slowly. The final row finishes lowest.",
      }],
    }, analysis);
    const visibleCopy = `${parsed.coachingItems[0].whatHappened} ${parsed.coachingItems[0].whatHappenedDetail}`;

    expect(visibleCopy.match(/[^.!?]+[.!?]+|[^.!?]+$/g)).toHaveLength(5);
    expect(parsed.coachingItems[0].whatHappenedDetail).toBe("Rep 3 drops quickly after reaching your ribs. Rep 4 repeats the faster lowering phase. The first two rows return more slowly. The final row finishes lowest.");
  });

  it("preserves complete natural writer sections and falls back only when a field is empty", () => {
    const raw = {
      ...writing,
      coachingItems: [{ ...writing.coachingItems[0], whatHappened: "One. Two. Three. Four." }],
    };

    expect(parseWholeVideoWriting(raw, analysis).coachingItems[0].whatHappened).toBe("One. Two. Three. Four.");
    expect(parseWholeVideoWriting({
      ...writing,
      coachingItems: [{ ...writing.coachingItems[0], whyItMatters: "The row changes. The visible path changes again." }],
    }, analysis).coachingItems[0].whyItMatters).toBe("The row changes. The visible path changes again.");
    expect(parseWholeVideoWriting({
      ...writing,
      coachingItems: [{ ...writing.coachingItems[0], whatToDo: "Lower both dumbbells for two seconds. Begin only after your arms reach the bottom." }],
    }, analysis).coachingItems[0].whatToDo).toBe("Lower both dumbbells for two seconds. Begin only after your arms reach the bottom.");
    expect(parseWholeVideoWriting({
      ...writing,
      coachingItems: [{ ...writing.coachingItems[0], whatHappenedDetail: "" }],
    }, analysis).coachingItems[0].whatHappenedDetail).toBe(analysis.coachingItems[0].observationDetails);
  });

  it("creates analyst-derived copy when the writer response is unavailable", () => {
    const parsed = parseWholeVideoWriting(null, analysis);

    expect(parsed.coachingItems[0]).toMatchObject({
      id: analysis.coachingItems[0].id,
      title: analysis.coachingItems[0].topic,
      whatHappened: analysis.coachingItems[0].observation,
      whatHappenedDetail: analysis.coachingItems[0].observationDetails,
      whyItMatters: analysis.coachingItems[0].whyItMatters,
      whyItMattersDetail: analysis.coachingItems[0].whyDetails,
      whatToDo: analysis.coachingItems[0].correctionDirection,
    });
    expect(parsed.coachNote.match(/[^.!?]+[.!?]+|[^.!?]+$/g)).toHaveLength(3);
    expect(parsed.overallAssessment.match(/[^.!?]+[.!?]+|[^.!?]+$/g)?.length).toBeGreaterThanOrEqual(3);
  });

  it("preserves concise writer sections without padding them to rigid sentence minimums", () => {
    const parsed = parseWholeVideoWriting({
      ...writing,
      overallAssessment: "The row changes late.",
      coachNote: "Slow the final rows.",
      coachingItems: [{
        ...writing.coachingItems[0],
        whatHappenedDetail: "Rep 3 drops quickly. Rep 4 repeats it.",
        whyItMattersDetail: "The late path changes.",
      }],
    }, analysis);
    const item = parsed.coachingItems[0];

    expect(item.whatHappenedDetail.match(/[^.!?]+[.!?]+|[^.!?]+$/g)).toHaveLength(2);
    expect(item.whyItMattersDetail).toBe("The late path changes.");
    expect(parsed.coachNote.match(/[^.!?]+[.!?]+|[^.!?]+$/g)).toHaveLength(3);
    expect(parsed.overallAssessment.match(/[^.!?]+[.!?]+|[^.!?]+$/g)?.length).toBeGreaterThanOrEqual(3);
  });

  it("removes numeric timestamps from What happened by using the stored video observation", () => {
    const parsed = parseWholeVideoWriting({
      ...writing,
      coachingItems: [{
        ...writing.coachingItems[0],
        whatHappened: "Both dumbbells returned faster at 1.4 seconds.",
        whatHappenedDetail: "Pressure moved toward your toes during the ascent. The shift repeated on rep 2.",
      }],
    }, analysis);

    expect(parsed.coachingItems[0].whatHappened).toBe(analysis.coachingItems[0].observation);
  });

  it("orders findings by analyst severity before harmless optimizations", () => {
    const raw = rawAnalysis(4);
    raw.coachingItems[0] = { ...raw.coachingItems[0], topic: "Setup variation", severity: "note", confidence: 0.99 };
    raw.coachingItems[1] = { ...raw.coachingItems[1], topic: "Loss of support", severity: "high", confidence: 0.81 };
    raw.coachingItems[2] = { ...raw.coachingItems[2], topic: "Path inconsistency", severity: "important", confidence: 0.95 };
    const parsed = parseBoundaryFreeAnalysis(raw, 9_000);

    expect(parsed.coachingItems.map((item) => item.topic).slice(0, 2)).toEqual([
      "Loss of support",
      "Path inconsistency",
    ]);
    expect(parsed.coachingItems.at(-1)?.topic).toBe("Setup variation");
  });
});
