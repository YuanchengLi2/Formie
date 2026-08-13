import {
  boundaryFreeToCandidate,
  buildBoundaryFreeAnalysisPrompt,
  buildBoundaryFreeRecheckPrompt,
  buildWholeVideoWritingPrompt,
  BOUNDARY_FREE_ANALYSIS_SCHEMA,
  parseBoundaryFreeAnalysis,
  parseRecheckRequest,
  mergeWholeVideoWriting,
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

describe("clean full-video analysis and coaching contract", () => {
  const rawAnalysis = (count: number) => {
    const coachingItems = Array.from({ length: count }, (_, index) => ({
      id: `finding-${index + 1}`,
      topic: `Visible squat issue ${index + 1}`,
      observation: `A distinct visible squat relationship changes for issue ${index + 1}.`,
      observationDetails: `The cited frame shows where issue ${index + 1} appears. The comparison uses the matching phase from the audited repetitions. The final sentence explains where the visible change is clearest.`,
      whyItMatters: `Issue ${index + 1} changes the squat path at the cited phase.`,
      whyDetails: `That visible difference makes the position less repeatable across the recorded set. The next repetition no longer matches the earlier path.`,
      correctionDirection: `Keep the cited body or equipment landmark aligned during the bottom phase of the next squat.`,
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
    raw.coachingItems.forEach((item: any) => delete item.observedIssueRegions);

    const parsed = parseBoundaryFreeAnalysis(raw, 9_000);

    expect(parsed.videoUnderstanding.beginning).toBe(raw.videoUnderstanding.repAudit[0].visualSummary);
    expect(parsed.videoUnderstanding.middle).toBe(raw.videoUnderstanding.repAudit[1].visualSummary);
    expect(parsed.videoUnderstanding.end).toBe(raw.videoUnderstanding.repAudit[2].visualSummary);
    expect(parsed.strengths).toEqual([]);
    expect(parsed.recheckRequest).toBeNull();
    expect(parsed.coachingItems.every((item) => item.observedIssueRegions.length === 0)).toBe(true);
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
    expect(coachingItem.properties.observedIssueRegions).toEqual(expect.objectContaining({ type: "array" }));
  });

  it("removes a claimed repetition that has no matching evidence moment", () => {
    const raw = v56RawAnalysis();
    raw.coachingItems[0].affectedRepNumbers = [1, 3];

    expect(parseBoundaryFreeAnalysis(raw, 9_000).coachingItems[0].affectedRepNumbers).toEqual([1]);
  });

  it("normalizes an unambiguous 0-to-10 provider score response to 0-to-100", () => {
    const raw = v56RawAnalysis();
    raw.movementScores.forEach((score: { score: number }, index: number) => { score.score = [5.8, 6.2, 5.5, 5.7][index]; });

    expect(parseBoundaryFreeAnalysis(raw, 9_000).movementScores.map((score) => score.score)).toEqual([58, 62, 55, 57]);
  });

  it("infers issue anatomy regions from visible evidence when the provider omits them", () => {
    const raw = v56RawAnalysis();
    raw.coachingItems[0].observedIssueRegions = undefined;
    raw.evidenceSelections[0].moments[0].visibleBodyAreas = ["right_shoulder", "right_arm"];

    expect(parseBoundaryFreeAnalysis(raw, 9_000).coachingItems[0].observedIssueRegions).toEqual(expect.arrayContaining(["shoulders", "upper_arms"]));
  });

  it("keeps all four findings when evidence omits optional repetition numbers", () => {
    const raw = v56RawAnalysis();
    raw.evidenceSelections = raw.evidenceSelections.map((selection) => ({
      ...selection,
      moments: selection.moments.map(({ repNumber: _repNumber, ...moment }) => moment),
    }));

    const parsed = parseBoundaryFreeAnalysis(raw, 9_000);

    expect(parsed.coachingItems).toHaveLength(4);
    expect(parsed.coachingItems.map((item) => item.affectedRepNumbers)).toEqual(
      raw.coachingItems.map((item) => item.affectedRepNumbers),
    );
  });

  it("uses the audited repetition as evidence fallback instead of rejecting the analysis", () => {
    const raw = v56RawAnalysis();
    raw.evidenceSelections[3].moments = [];

    const parsed = parseBoundaryFreeAnalysis(raw, 9_000);

    expect(parsed.coachingItems).toHaveLength(4);
    expect(parsed.coachingItems[3].evidence).toHaveLength(1);
    expect(parsed.coachingItems[3].evidence[0]).toMatchObject({
      repNumber: 1,
      startMs: raw.videoUnderstanding.repAudit[0].startMs,
      peakMs: raw.videoUnderstanding.repAudit[0].peakMs,
      endMs: raw.videoUnderstanding.repAudit[0].endMs,
    });
  });

  it("returns four to six ranked issues without rejecting a longer usable response", () => {
    expect(parseBoundaryFreeAnalysis(rawAnalysis(5), 9_000).coachingItems).toHaveLength(5);
    expect(parseBoundaryFreeAnalysis(rawAnalysis(6), 9_000).coachingItems).toHaveLength(6);
    expect(parseBoundaryFreeAnalysis(rawAnalysis(7), 9_000).coachingItems).toHaveLength(6);
  });

  it("preserves exercise-specific explanations without keyword censorship", () => {
    const raw = v56RawAnalysis();
    raw.coachingItems[0].whyItMatters = "Partial depth limits full lower-body muscle activation.";
    raw.coachingItems[0].whyDetails = "Greater depth optimizes quadriceps and glute development.";
    raw.coachingItems[1].whyItMatters = "This position increases joint stress.";
    raw.coachingItems[1].whyDetails = "The change reduces muscular tension and power production.";

    const parsed = parseBoundaryFreeAnalysis(raw, 9_000);

    expect(parsed.coachingItems).toHaveLength(4);
    expect(parsed.coachingItems[0].whyItMatters).toBe(raw.coachingItems[0].whyItMatters);
    expect(parsed.coachingItems[0].whyDetails).toBe(raw.coachingItems[0].whyDetails);
    expect(parsed.coachingItems[1].whyItMatters).toBe(raw.coachingItems[1].whyItMatters);
    expect(parsed.coachingItems[1].whyDetails).toBe(raw.coachingItems[1].whyDetails);
    expect(parsed.coachingItems[0].observation).toBe(raw.coachingItems[0].observation);
  });

  it("does not replace advanced coaching language with a generic visible-pattern sentence", () => {
    const raw = v56RawAnalysis();
    raw.coachingItems[3].whyItMatters = "Rapid turnaround reduces muscular tension at the deep position.";

    const parsed = parseBoundaryFreeAnalysis(raw, 9_000);

    expect(parsed.coachingItems).toHaveLength(4);
    expect(parsed.coachingItems[3].whyItMatters).toBe("Rapid turnaround reduces muscular tension at the deep position.");
  });

  it("accepts four distinct evidence-backed coaching findings", () => {
    const parsed = parseBoundaryFreeAnalysis(rawAnalysis(4), 9_000);

    expect(parsed.coachingItems).toHaveLength(4);
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

  it("leaves analyst wording intact for the separate coaching writer", () => {
    const raw = rawAnalysis(4);
    raw.coachingItems[3].observation = "One. Two. Three. Four.";
    raw.coachingItems[3].observationDetails = "Only one supporting sentence is returned.";
    raw.coachingItems[3].correctionDirection = "Make the correction. Keep doing it.";

    const parsed = parseBoundaryFreeAnalysis(raw, 9_000);

    expect(parsed.coachingItems).toHaveLength(4);
    expect(parsed.coachingItems[3].observation).toBe("One. Two. Three. Four.");
    expect(parsed.coachingItems[3].observationDetails).toBe("Only one supporting sentence is returned.");
    expect(parsed.coachingItems[3].correctionDirection).toBe("Make the correction. Keep doing it.");
  });

  it("asks for four to six form issues after understanding the complete video", () => {
    const prompt = buildBoundaryFreeAnalysisPrompt(9_000);

    expect(prompt).toContain("Watch and understand the complete recording");
    expect(prompt).toContain("beginning, middle, and end");
    expect(prompt).toContain("Return four to six distinct form issues");
    expect(prompt).toContain("hands and grip");
    expect(prompt).toContain("equipment and contact points");
    expect(prompt).toContain("body position and alignment");
    expect(prompt).toContain("left-right imbalance");
    expect(prompt).toContain("recommended checks, not required categories");
    expect(prompt).toContain("Do not report ordinary differences between repetitions, sets, or intentional variations as issues");
    expect(prompt).toContain("Do not title or describe an issue as inconsistency, variation, or a change between repetitions");
    expect(prompt).toContain("Changing arm position during a bodyweight squat is not itself a form issue");
    expect(prompt).toContain("Do not infer a counterbalance benefit or balance fault from arm position alone");
    expect(prompt).toContain("Do not report arm position as a second explanation for an already-reported torso or balance fault");
    expect(prompt).not.toContain("universal path decision gate");
    expect(prompt).not.toContain("Your target is six real coaching issues");
    expect(prompt).not.toContain("Keep each coaching sentence under 18 words");
  });

  it("rejects an analysis that does not audit every observed repetition", () => {
    const missing = rawAnalysis(4);
    delete (missing.videoUnderstanding as { repAudit?: unknown }).repAudit;
    expect(() => parseBoundaryFreeAnalysis(missing, 9_000)).toThrow(/repAudit/i);

    const concentrated = rawAnalysis(4);
    concentrated.videoUnderstanding.repAudit = concentrated.videoUnderstanding.repAudit.slice(0, 2);
    expect(() => parseBoundaryFreeAnalysis(concentrated, 9_000)).toThrow(/every observed repetition/i);
  });

  it("keeps the analyst focused on evidence instead of prescribing the writer's prose", () => {
    const prompt = buildBoundaryFreeAnalysisPrompt(10_000);

    expect(prompt).toContain("Only identify problems with the performed form itself");
    expect(prompt).toContain("Every issue must be specific to the declared exercise and supported by visible evidence");
    expect(prompt).toContain("Pass the resulting evidence-backed issue record to the coaching writer");
    expect(prompt).toContain("Always set recheckRequest to null");
    expect(prompt).not.toContain("observation must be exactly one complete sentence");
    expect(prompt).not.toContain("whyDetails must contain two to four normal supporting sentences");
    expect(prompt).not.toContain("Spread primaryEvidenceIndex choices");
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

  it("asks the writer for specific natural coaching with only the requested section shapes", () => {
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
    expect(prompt).toContain('"peakSeconds":5.3');
    expect(prompt).not.toMatch(/"(?:start|peak|end)Ms"/);
    expect(WHOLE_VIDEO_WRITER_SYSTEM_INSTRUCTION).toContain("whatHappened must be one short summary sentence");
    expect(WHOLE_VIDEO_WRITER_SYSTEM_INSTRUCTION).toContain("whatHappenedDetail must be exactly two supporting sentences");
    expect(WHOLE_VIDEO_WRITER_SYSTEM_INSTRUCTION).toContain("whyItMatters must be one short summary sentence");
    expect(WHOLE_VIDEO_WRITER_SYSTEM_INSTRUCTION).toContain("whyItMattersDetail must be exactly two supporting sentences");
    expect(WHOLE_VIDEO_WRITER_SYSTEM_INSTRUCTION).toContain("whatToDo must be exactly one actionable sentence");
    expect(WHOLE_VIDEO_WRITER_SYSTEM_INSTRUCTION).toContain("specific to this exercise, this set, and the supplied video evidence");
    expect(WHOLE_VIDEO_WRITER_SYSTEM_INSTRUCTION).toContain("Do not use a reusable sentence template");
    expect(WHOLE_VIDEO_WRITER_SYSTEM_INSTRUCTION).toContain("Vary sentence openings, order, cadence, and explanation across findings");
    expect(WHOLE_VIDEO_WRITER_SYSTEM_INSTRUCTION).toContain("precise coaching language while keeping it easy to understand");
    expect(WHOLE_VIDEO_WRITER_SYSTEM_INSTRUCTION).toContain("name the actual form fault rather than the fact that repetitions differ");
    expect(WHOLE_VIDEO_WRITER_SYSTEM_INSTRUCTION).not.toContain("Keep each sentence under 18 words");
    expect(WHOLE_VIDEO_WRITER_SYSTEM_INSTRUCTION).not.toContain("Avoid technical anatomy and biomechanics terms");
    expect(WHOLE_VIDEO_WRITER_SYSTEM_INSTRUCTION).not.toContain("clear gym coach speaking between sets");
  });

  it("preserves advanced exercise-specific coaching instead of replacing it with a formulaic fallback", () => {
    const parsed = mergeWholeVideoWriting({
      ...writing,
      coachingItems: [{
        ...writing.coachingItems[0],
        whatHappenedDetail: "The right scapula elevates as the dumbbell approaches the ribs. Your torso remains supported on the bench. The asymmetry is clearest at the top of the row.",
        whyItMatters: "Scapular asymmetry compromises force transfer through the upper body.",
        whyItMattersDetail: "The elevated side changes the pulling line of the chest-supported row. That makes it harder to finish both dumbbells from the same shoulder position. It can also shift more of the correction into your torso.",
      }],
    }, analysis);

    expect(parsed.coachingItems[0].whatHappenedDetail).toContain("right scapula elevates");
    expect(parsed.coachingItems[0].whatHappenedDetail?.match(/[^.!?]+[.!?]+|[^.!?]+$/g)).toHaveLength(2);
    expect(parsed.coachingItems[0].whyItMatters).toBe("Scapular asymmetry compromises force transfer through the upper body.");
    expect(parsed.coachingItems[0].whyItMattersDetail).toContain("pulling line of the chest-supported row");
    expect(parsed.coachingItems[0].whyItMattersDetail?.match(/[^.!?]+[.!?]+|[^.!?]+$/g)).toHaveLength(2);
  });

  it("shapes writer prose into one headline sentence and two supporting sentences", () => {
    const unrestricted = {
      ...writing.coachingItems[0],
      title: "Depth",
      whatHappened: "Your right knee moves inward. The shift is clearest at the bottom.",
      whatHappenedDetail: "The knee crosses inside the foot. Your heel remains planted. The bar stays over the midfoot. The camera keeps the leg visible.",
      whyItMatters: "This changes how the squat receives the load. The effect continues into the ascent.",
      whyItMattersDetail: "The inward knee changes the leg's alignment under the bar. Your hip then shifts to keep the bar centered. The ascent starts from an uneven base. That can make the same squat harder to reproduce.",
      whatToDo: "Drive your right knee over your second toe. Keep that line through the ascent.",
      successCheck: "Watch the knee stay over the foot. Confirm the hip remains centered.",
    };

    const parsed = mergeWholeVideoWriting({
      ...writing,
      coachingItems: [unrestricted],
    }, analysis).coachingItems[0];

    expect(parsed).toMatchObject({
      ...unrestricted,
      whatHappened: "Your right knee moves inward.",
      whatHappenedDetail: "The knee crosses inside the foot. Your heel remains planted.",
      whyItMatters: "This changes how the squat receives the load.",
      whyItMattersDetail: "The inward knee changes the leg's alignment under the bar. Your hip then shifts to keep the bar centered.",
    });
  });

  it("converts leaked millisecond timestamps to readable seconds without rejecting the writing", () => {
    const parsed = mergeWholeVideoWriting({
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
    const parsed = mergeWholeVideoWriting(writing, analysis);
    expect(parsed.coachingItems[0].title).toBe("Slow the late-row return");
  });

  it("preserves writer headlines without length or line-count rejection", () => {
    const multiline = mergeWholeVideoWriting({
      ...writing,
      coachingItems: [{ ...writing.coachingItems[0], title: "Slow the return\nKeep the dumbbells controlled" }],
    }, analysis);
    expect(multiline.coachingItems[0].title).toBe("Slow the return\nKeep the dumbbells controlled");

    const long = mergeWholeVideoWriting({
      ...writing,
      coachingItems: [{ ...writing.coachingItems[0], title: "Keep both dumbbells moving through the entire lowering phase with exactly the same controlled speed on every repetition" }],
    }, analysis);
    expect(long.coachingItems[0].title).toBe("Keep both dumbbells moving through the entire lowering phase with exactly the same controlled speed on every repetition");
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

  it("keeps exactly two supporting sentences for presentation", () => {
    const parsed = mergeWholeVideoWriting({
      ...writing,
      coachingItems: [{
        ...writing.coachingItems[0],
        whatHappenedDetail: "Rep 3 drops quickly after reaching your ribs. Rep 4 repeats the faster lowering phase. The first two rows return more slowly. The final row finishes lowest.",
      }],
    }, analysis);
    expect(parsed.coachingItems[0].whatHappened.match(/[^.!?]+[.!?]+|[^.!?]+$/g)).toHaveLength(1);
    expect(parsed.coachingItems[0].whatHappenedDetail?.match(/[^.!?]+[.!?]+|[^.!?]+$/g)).toHaveLength(2);
    expect(parsed.coachingItems[0].whatHappenedDetail).toBe("Rep 3 drops quickly after reaching your ribs. Rep 4 repeats the faster lowering phase.");
  });

  it("keeps actions free-form while shaping What Happened and Why It Matters", () => {
    const raw = {
      ...writing,
      coachingItems: [{ ...writing.coachingItems[0], whatHappened: "One. Two. Three. Four." }],
    };

    expect(mergeWholeVideoWriting(raw, analysis).coachingItems[0].whatHappened).toBe("One.");
    expect(mergeWholeVideoWriting({
      ...writing,
      coachingItems: [{ ...writing.coachingItems[0], whyItMatters: "The row changes. The visible path changes again." }],
    }, analysis).coachingItems[0].whyItMatters).toBe("The row changes.");
    expect(mergeWholeVideoWriting({
      ...writing,
      coachingItems: [{ ...writing.coachingItems[0], whatToDo: "Lower both dumbbells for two seconds. Begin only after your arms reach the bottom." }],
    }, analysis).coachingItems[0].whatToDo).toBe("Lower both dumbbells for two seconds. Begin only after your arms reach the bottom.");
    expect(mergeWholeVideoWriting({
      ...writing,
      coachingItems: [{ ...writing.coachingItems[0], whatHappenedDetail: "" }],
    }, analysis).coachingItems[0].whatHappenedDetail).toBe("Rep 3 drops faster from the ribs to the bottom. Rep 4 repeats that faster lowering phase.");
  });

  it("creates analyst-derived copy when the writer response is unavailable", () => {
    const parsed = mergeWholeVideoWriting(null, analysis);

    expect(parsed.coachingItems[0]).toMatchObject({
      id: analysis.coachingItems[0].id,
      title: analysis.coachingItems[0].topic,
      whatHappened: analysis.coachingItems[0].observation,
      whatHappenedDetail: "Rep 3 drops faster from the ribs to the bottom. Rep 4 repeats that faster lowering phase.",
      whyItMatters: analysis.coachingItems[0].whyItMatters,
      whyItMattersDetail: "The late repetitions no longer match the opening pull-and-return rhythm. That makes their path less repeatable.",
      whatToDo: analysis.coachingItems[0].correctionDirection,
    });
    expect(parsed.coachNote.match(/[^.!?]+[.!?]+|[^.!?]+$/g)).toHaveLength(3);
    expect(parsed.overallAssessment.match(/[^.!?]+[.!?]+|[^.!?]+$/g)?.length).toBeGreaterThanOrEqual(3);
  });

  it("accepts short writer sections without replacing them", () => {
    const parsed = mergeWholeVideoWriting({
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
    expect(item.whyItMattersDetail).toBe("The late path changes. The late repetitions no longer match the opening pull-and-return rhythm.");
    expect(parsed.coachNote).toBe("Slow the final rows.");
    expect(parsed.overallAssessment).toBe("The row changes late.");
  });
});
