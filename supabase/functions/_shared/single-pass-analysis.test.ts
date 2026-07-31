import { ANALYSIS_DECISION_SCHEMA, COMBINED_ANALYSIS_SCHEMA, WRITER_COPY_SCHEMA, WRITER_AUDIT_SCHEMA, analysisValidationFailureCode, buildCombinedAnalysisPrompt, buildSinglePassAnalysisPrompt, buildTargetedContradictionReviewPrompt, buildWriterAuditPrompt, buildWriterCopyPrompt, buildWriterCopyRepairPrompt, detectRawFactualContradictions, mergeWriterCopy, parseAnalysisDecision, parseCombinedAnalysisResponse, parseWriterAuditResponse, parseWriterCopyPatch, rankCorrections, targetedReviewWindows, writerAuditSchema, writerCopySchema } from "./single-pass-analysis";
import type { SetDeclaration } from "./set-declaration";

const declaredBench: SetDeclaration = {
  exercise: { source: "catalog", catalogExerciseId: 3, label: "Dumbbell Bench Press" },
  amount: { kind: "reps", value: 8, countScope: "total" },
  load: { kind: "known", value: 40, unit: "lb", scope: "per_hand" },
  side: "bilateral",
  styles: ["paused"],
  focusNote: "Watch my left shoulder",
};

function decision(): any {
  return {
    status: "complete",
    recognition: { label: "One-arm dumbbell row", variation: null, equipment: ["dumbbell", "bench"], confidence: 0.94, alternatives: [], exerciseFamily: "row" },
    videoCheck: { outcome: "usable", usableObservations: ["torso", "working arm", "dumbbell"], limitations: ["low rear camera"], retryReason: null, retryInstruction: null },
    wholeSetCoverage: {
      activeSetStartMs: 4_000,
      activeSetEndMs: 17_500,
      checkpoints: [
        { position: "beginning", startMs: 4_000, endMs: 7_500, observation: "The first repetition has a planted base and controlled return." },
        { position: "middle", startMs: 7_750, endMs: 11_250, observation: "The middle repetition keeps a similar path and range." },
        { position: "end", startMs: 15_000, endMs: 17_500, observation: "The final return is visibly faster than the beginning." },
      ],
      changeAcrossSet: "The base remains planted while lowering control decreases late in the set.",
    },
    movementAnalysis: "Joint actions: the shoulder extends and the elbow bends as the upper arm travels behind the torso. Implement path: the dumbbell travels upward and backward toward the side of the torso. Repetition pattern: the same shoulder, elbow, and dumbbell path repeats across four repetitions. Full-set progression: the same pulling movement continues through the final repetition, with a faster return late in the set.",
    overallAssessment: "The set is usable, but torso rotation and lowering control limit the final repetitions.",
    score: 72,
    scoreRationale: [
      { criterion: "setup_stability", assessment: "strong", observed: "The support hand and knee remain planted.", impact: 5, confidence: 0.9, evidenceIds: ["stable-base"] },
      { criterion: "path_alignment", assessment: "strong", observed: "The visible pull path remains close to the torso.", impact: 5, confidence: 0.85, evidenceIds: [] },
      { criterion: "range_positions", assessment: "strong", observed: "The visible top and bottom positions remain repeatable.", impact: 5, confidence: 0.85, evidenceIds: [] },
      { criterion: "control_tempo", assessment: "issue", observed: "The lowering phase speeds up on reps three and four.", impact: 30, confidence: 0.9, evidenceIds: ["tempo-loss"] },
      { criterion: "rep_consistency", assessment: "issue", observed: "The final repetitions return faster than the first two.", impact: 25, confidence: 0.9, evidenceIds: ["tempo-loss"] },
    ],
    movementScores: [
      { id: "dumbbell-path", label: "Dumbbell Path", score: 74, observed: "The dumbbell stays close to the torso throughout the visible pull.", evidenceIds: ["tempo-loss"] },
      { id: "torso-control", label: "Torso Control", score: 88, observed: "The planted support points remain steady through the visible set.", evidenceIds: ["stable-base"] },
      { id: "lowering-control", label: "Lowering Control", score: 62, observed: "The lowering phase becomes faster during the final repetitions.", evidenceIds: ["tempo-loss"] },
    ],
    findings: [
      {
        id: "tempo-loss",
        kind: "correction",
        title: "Control the lowering phase",
        detail: "The dumbbell drops faster on the cited final repetition.",
        whyItMatters: "A controlled return keeps the torso and shoulder position repeatable.",
        correction: "Lower the dumbbell deliberately for the full return.",
        cue: "Pull, pause, lower slowly.",
        actionableCorrection: { instruction: "Use a slower return on every rep.", cue: "Own the way down.", successCheck: "The final rep takes as long to lower as the first.", applyWhen: "During the eccentric phase." },
        severity: "important",
        observedIssueRegions: [],
        evidence: [{ startMs: 15_000, peakMs: 16_500, endMs: 17_000, repNumber: 4, phase: "eccentric", visualEvidence: "The dumbbell returns faster than on the first repetition.", coachingNote: "Slow the return until the dumbbell reaches the same bottom position.", visibleBodyAreas: ["working arm", "torso", "dumbbell"], confidence: 0.9, focusRegion: null }],
      },
      {
        id: "stable-base",
        kind: "strength",
        title: "Stable support points",
        detail: "The support hand and knee remain planted.",
        whyItMatters: "A stable base makes the pull repeatable.",
        correction: null,
        cue: "Keep the base planted.",
        actionableCorrection: null,
        severity: "note",
        observedIssueRegions: [],
        evidence: [{ startMs: 4_000, peakMs: 5_500, endMs: 6_000, repNumber: 1, phase: "concentric", visualEvidence: "The support hand and knee stay planted.", coachingNote: "Keep these contact points unchanged.", visibleBodyAreas: ["support arm", "support leg"], confidence: 0.9, focusRegion: null }],
      },
    ],
    equipmentObservations: [],
    setContext: { cameraView: "low rear diagonal", visibleReferences: ["bench", "dumbbell"], sequenceSummary: "Four repetitions are visible.", changeAcrossSet: "The return becomes faster late in the set.", coachingBasis: "Prioritize lowering control." },
    setSummary: { totalReps: 4, consistentReps: 2, verdict: "Control drops on the final repetitions." },
    repTimeline: [
      { repNumber: 1, startMs: 4_000, peakMs: 5_500, endMs: 7_500, assessment: "consistent", note: "Controlled repetition." },
      { repNumber: 2, startMs: 7_750, peakMs: 9_500, endMs: 11_250, assessment: "consistent", note: "Similar control." },
      { repNumber: 3, startMs: 11_500, peakMs: 13_000, endMs: 14_750, assessment: "breakdown", note: "The return speeds up." },
      { repNumber: 4, startMs: 15_000, peakMs: 16_500, endMs: 17_500, assessment: "breakdown", note: "The fastest return." },
    ],
    nextSetPlan: [{ id: "plan-tempo", action: "Use a slower return on every rep.", rationale: "Keep control consistent through the set.", successCheck: "The final return matches the first.", relatedFindingId: "tempo-loss" }],
  };
}

function writerPatch(overrides: Record<string, unknown> = {}): any {
  return {
    overallAssessment: "The set keeps a planted base and close dumbbell path from beginning to end. The return speeds up late, so match the final lowering phase to the first.",
    muscleFocus: {
      primary: [
        { name: "Latissimus dorsi", region: "lats" },
        { name: "Upper back", region: "upper_back" },
      ],
      secondary: [{ name: "Biceps", region: "biceps" }],
    },
    coachNote: "Keep your repeatable support position while making the final lowering phase look as deliberate as the first.",
    findings: [{
      findingId: "tempo-loss",
      title: "Match the lowering pace",
      whatHappened: "The dumbbell returns under control early, then moves down faster near the end of the set.",
      whyItMatters: "A repeatable lowering pace keeps the bottom position consistent. Here, the faster late return makes the last movement look different from the opening movement.",
      whatToDo: "Use one cue for the full set: own the way down.",
    }],
    ...overrides,
  };
}

describe("single-pass analysis contract", () => {
  it("rejects finding evidence outside the real exercise interval", () => {
    const source = decision();
    source.findings[0].evidence[0] = {
      ...source.findings[0].evidence[0],
      startMs: 18_000,
      peakMs: 19_000,
      endMs: 20_000,
      repNumber: null,
      phase: "setup",
      visualEvidence: "The person sits back down after the set.",
    };

    expect(() => parseAnalysisDecision(source, 25_020)).toThrow(/outside the active-set interval/i);
  });

  it("rejects repetition events outside the real exercise interval", () => {
    const source = decision();
    source.repTimeline.push({
      repNumber: 5,
      startMs: 18_000,
      peakMs: 19_000,
      endMs: 20_000,
      assessment: "uncertain",
      note: "The person sits back down after the set.",
    });

    expect(() => parseAnalysisDecision(source, 25_020)).toThrow(/outside the active-set interval/i);
  });

  it("preserves a complete setup-to-execution guide and six-domain coaching audit", () => {
    const source = decision();
    source.exerciseGuide = {
      setupSteps: ["Clear the floor beside the bench.", "Plant the support hand and knee before lifting."],
      executionSteps: ["Pull the dumbbell toward the side of the torso.", "Match the final lowering pace to the first."],
      relatedFindingIds: ["tempo-loss"],
    };
    source.coachingCoverage = [
      { domain: "surroundings", status: "clear", observation: "The floor beside the bench is clear.", findingIds: [] },
      { domain: "equipment_setup", status: "clear", observation: "The bench stays fixed.", findingIds: [] },
      { domain: "grip_contact", status: "clear", observation: "The working hand keeps the same contact.", findingIds: [] },
      { domain: "starting_position", status: "clear", observation: "The support hand and knee remain planted.", findingIds: [] },
      { domain: "movement_execution", status: "issue", observation: "The lowering phase speeds up late.", findingIds: ["tempo-loss"] },
      { domain: "support_balance", status: "clear", observation: "The support base stays steady.", findingIds: [] },
    ];

    const parsed = parseAnalysisDecision(source, 25_020);
    const result = mergeWriterCopy(parsed, writerPatch());

    expect(parsed.coachingCoverage.map((item) => item.domain)).toEqual([
      "surroundings",
      "equipment_setup",
      "grip_contact",
      "starting_position",
      "movement_execution",
      "support_balance",
    ]);
    expect(result.exerciseGuide?.executionSteps).toContain("Match the final lowering pace to the first.");
    expect(result.coachingCoverage?.find((item) => item.domain === "movement_execution")?.findingIds).toEqual(["tempo-loss"]);
  });

  it("keeps declared identity out while allowing only confident repetition timelines", () => {
    const required = [...ANALYSIS_DECISION_SCHEMA.required];
    const evidence = (ANALYSIS_DECISION_SCHEMA.$defs.finding.properties.evidence as any).items;

    expect(required).not.toEqual(expect.arrayContaining(["recognition", "setSummary", "nextSetPlan"]));
    expect(ANALYSIS_DECISION_SCHEMA.properties).not.toHaveProperty("recognition");
    expect(required).toContain("repTimeline");
    expect(ANALYSIS_DECISION_SCHEMA.properties).toHaveProperty("repTimeline");
    expect(evidence.required).toContain("repNumber");
    expect(evidence.properties.repNumber).toMatchObject({ type: ["integer", "null"] });

    const prompt = buildSinglePassAnalysisPrompt(25_020, declaredBench);
    expect(prompt).toContain("Do not identify or rename the exercise");
    expect(prompt).toContain("Build repTimeline only when the complete repetition boundaries are visually clear");
    expect(prompt).toContain("When the timeline is uncertain, return an empty repTimeline");
    expect(prompt).toContain("Only attach repNumber to evidence when that number is validated by repTimeline");
  });

  it("requires factual analysis before coaching and audits every contradiction category", () => {
    const prompt = buildWriterAuditPrompt(parseAnalysisDecision(decision(), 25_020));
    expect(prompt).toContain("factual analyst decision is immutable");
    expect(prompt).toContain("observations, score, coaching, repetition counts, and timestamps");
    expect(prompt).toContain("equipment, grip, setup, posture, stance, range, tempo, and full-set changes");
    expect(WRITER_AUDIT_SCHEMA.required).toEqual(["coaching", "contradictions"]);
    expect((((writerAuditSchema(parseAnalysisDecision(decision(), 25_020)) as any).properties.coaching.properties.findings.items.properties.findingId.enum))).toEqual(["tempo-loss"]);
  });

  it("writes both observed corrections and clearly labeled advice cues", () => {
    const source = decision();
    const [correction, strength] = source.findings;
    const corrections = [
      correction,
      { ...correction, id: "range-problem" },
      { ...correction, id: "transition-problem" },
      { ...correction, id: "setup-problem" },
    ];
    const advice = {
      ...correction,
      id: "bench-safety-check",
      title: "Bench setup reminder",
      detail: "This is general setup advice for the next set, not an observed mistake.",
      whyItMatters: "A fixed bench and clear floor space make the setup easier to repeat.",
      correction: "Check that the bench is stable and the floor space is clear before starting.",
      cue: "Bench set, floor clear.",
      severity: "note",
      observedIssueRegions: [],
    };
    const { findings: _findings, ...base } = source;
    const parsed = parseAnalysisDecision({
      ...base,
      corrections,
      strengths: [strength, { ...strength, id: "steady-path" }],
      cues: [advice],
    }, 25_020);
    const schema = writerAuditSchema(parsed) as any;
    expect(schema.properties.coaching.properties.findings.items.properties.findingId.enum).toEqual([
      "tempo-loss",
      "range-problem",
      "transition-problem",
      "setup-problem",
      "bench-safety-check",
    ]);
    const patch = parseWriterCopyPatch(writerPatch({
      findings: [
        ...corrections.map((item) => ({
          ...writerPatch().findings[0],
          findingId: item.id,
        })),
        {
          findingId: "bench-safety-check",
          title: "Set the bench before you lift",
          whatHappened: "The lowering speed currently varies, so every repetition needs more control.",
          whyItMatters: "A bench that stays fixed gives you the same starting position each time.",
          whatToDo: "Before lifting, check that the bench is stable and the nearby floor is clear.",
        },
      ],
    }), parsed);
    expect(patch.findings.map((finding) => finding.findingId)).toEqual([
      "tempo-loss",
      "range-problem",
      "transition-problem",
      "setup-problem",
      "bench-safety-check",
    ]);
    expect(patch.findings[4].whatHappened).toBe(
      "This is general advice for your next set, not a mistake observed in this recording. Use it during the lowering phase shown here.",
    );
  });

  it("rejects usable model results that substitute strengths or advice for four genuine problems", () => {
    const source = decision();
    const [correction, strength] = source.findings;
    const { findings: _findings, ...base } = source;
    const correctionWithId = (id: string) => ({ ...correction, id });
    const advice = {
      ...correction,
      id: "setup-advice",
      kind: "cue",
      detail: "This is general setup advice for the next set, not an observed mistake.",
      severity: "note",
    };

    expect(() => parseAnalysisDecision({
      ...base,
      corrections: [
        correctionWithId("problem-1"),
        correctionWithId("problem-2"),
        correctionWithId("problem-3"),
      ],
      strengths: [strength],
      cues: [advice],
    }, 25_020)).toThrow(/at least four distinct.*corrections/i);

    expect(parseAnalysisDecision({
      ...base,
      corrections: [
        correctionWithId("problem-1"),
        correctionWithId("problem-2"),
        correctionWithId("problem-3"),
        correctionWithId("problem-4"),
      ],
      strengths: [strength],
      cues: [advice],
    }, 25_020).findings.filter((finding) => finding.kind === "correction")).toHaveLength(4);

    expect(ANALYSIS_DECISION_SCHEMA.properties.corrections).toMatchObject({ minItems: 4 });
  });

  it("keeps legacy split inventories readable while counting every correction area toward four", () => {
    const source = decision();
    const [correction, strength] = source.findings;
    const { findings: _findings, ...base } = source;
    const form = (id: string) => ({ ...correction, id, title: `Form ${id}` });
    const supplemental = (id: string, coachingArea: string) => ({ ...correction, id, title: `Supplemental ${id}`, coachingArea });

    const parsed = parseAnalysisDecision({
      ...base,
      formCorrections: [form("form-1"), form("form-2"), form("form-3")],
      additionalCorrections: [
        supplemental("load-1", "load"),
        supplemental("safety-1", "safety_surroundings"),
      ],
      strengths: [strength],
      cues: [],
    }, 25_020);
    const merged = mergeWriterCopy(parsed, null);

    expect(merged.priorityCorrections.map((finding) => finding.coachingArea)).toEqual([
      "form",
      "form",
      "form",
      "load",
      "safety_surroundings",
    ]);
    expect(ANALYSIS_DECISION_SCHEMA.properties.corrections).toMatchObject({ minItems: 4 });
    expect(ANALYSIS_DECISION_SCHEMA.properties).not.toHaveProperty("additionalCorrections");
  });

  it("counts every evidence-backed whole-lift problem toward the four-correction minimum and keeps findings beyond four", () => {
    const source = decision();
    const [correction, strength] = source.findings;
    const { findings: _findings, ...base } = source;
    const wholeLiftCorrection = (id: string, coachingArea: string, title: string) => ({
      ...correction,
      id,
      coachingArea,
      title,
    });
    const corrections = [
      wholeLiftCorrection("stance-distance", "posture_setup", "Stand closer to the cable"),
      wholeLiftCorrection("torso-lean", "posture_setup", "Set a repeatable torso lean"),
      wholeLiftCorrection("handle-position", "grip_contact", "Center the handle in both hands"),
      wholeLiftCorrection("stack-control", "equipment", "Keep the stack from slamming"),
      wholeLiftCorrection("load-control", "load", "Use a load you can control"),
      wholeLiftCorrection("clearance", "safety_surroundings", "Clear the cable path"),
    ];

    const parsed = parseAnalysisDecision({
      ...base,
      corrections,
      strengths: [strength],
      cues: [],
    }, 25_020);
    const merged = mergeWriterCopy(parsed, null);

    expect(parsed.findings.filter((finding) => finding.kind === "correction")).toHaveLength(6);
    expect(merged.priorityCorrections.map((finding) => finding.coachingArea)).toEqual([
      "posture_setup",
      "posture_setup",
      "grip_contact",
      "equipment",
      "load",
      "safety_surroundings",
    ]);
  });

  it("exposes one whole-lift correction inventory with a four-problem floor and no schema maximum", () => {
    const schema = ANALYSIS_DECISION_SCHEMA as any;

    expect(schema.properties.corrections).toEqual(expect.objectContaining({
      type: ["array", "null"],
      minItems: 4,
    }));
    expect(schema.properties.corrections.maxItems).toBeUndefined();
    expect(schema.properties).not.toHaveProperty("formCorrections");
    expect(schema.properties).not.toHaveProperty("additionalCorrections");
    expect(schema.$defs.finding.required).toContain("coachingArea");
  });

  it("keeps coaching material inside real exercise repetitions", () => {
    const prompt = buildSinglePassAnalysisPrompt(25_020);

    expect(prompt).toContain("one ranked correction inventory");
    expect(prompt).toContain("Inspect only the complete active exercise");
    expect(prompt).toContain("in-rep stance and posture");
    expect(prompt).toContain("A category label never permits evidence from outside a real repetition");
    expect(prompt).toContain("Four is a minimum, not a maximum");
    expect(prompt).toContain("Never turn sitting down, standing up, walking, repositioning");
  });

  it("calibrates observations for camera angle, subject distance, and perspective distortion", () => {
    const prompt = buildSinglePassAnalysisPrompt(25_020, declaredBench);

    expect(prompt).toContain("camera-to-subject distance");
    expect(prompt).toContain("viewing direction");
    expect(prompt).toContain("foreshortening");
    expect(prompt).toContain("body-relative and equipment-relative landmarks");
  });

  it("normalizes the lean provider inventory into complete carousel findings", () => {
    const source = decision();
    const [correction, strength] = source.findings;
    const { findings: _findings, ...base } = source;
    const withoutProviderDerivedFields = (finding: any, id: string) => {
      const {
        coachingArea: _coachingArea,
        actionableCorrection: _actionableCorrection,
        ...lean
      } = { ...finding, id, title: `Form ${id}` };
      return lean;
    };
    const supplemental = {
      id: "clear-floor",
      coachingArea: "safety_surroundings",
      title: "Loose plate beside the stance",
      detail: "A loose plate is visible beside the right foot during the set.",
      correction: "Move the loose plate outside the recording and lifting area.",
      severity: "important",
      evidence: correction.evidence,
    };

    const parsed = parseAnalysisDecision({
      ...base,
      formCorrections: [
        withoutProviderDerivedFields(correction, "form-1"),
        withoutProviderDerivedFields(correction, "form-2"),
        withoutProviderDerivedFields(correction, "form-3"),
        withoutProviderDerivedFields(correction, "form-4"),
      ],
      additionalCorrections: [supplemental],
      strengths: [withoutProviderDerivedFields(strength, "stable-base")],
      cues: [],
    }, 25_020);
    const added = parsed.findings.find((finding) => finding.id === "clear-floor");

    expect(added).toMatchObject({
      kind: "correction",
      coachingArea: "safety_surroundings",
      whyItMatters: supplemental.detail,
      correction: supplemental.correction,
      cue: null,
      observedIssueRegions: [],
      actionableCorrection: {
        instruction: supplemental.correction,
        cue: supplemental.correction,
        successCheck: null,
        applyWhen: "Before the next set.",
      },
    });
    expect(parsed.findings.filter((finding) => finding.kind === "correction" && finding.coachingArea === "form")).toHaveLength(4);
  });

  it("requires comfort-based range cues in direct gym language", () => {
    const source = parseAnalysisDecision(decision(), 25_020);
    expect(buildWriterCopyPrompt(source)).toContain('"brace," "braced," and "bracing"');
    expect(() => parseWriterCopyPatch(writerPatch({
      findings: [{
        findingId: "tempo-loss",
        title: "Use more range",
        whatHappened: "The dumbbell stops above the visible bottom position on the cited repetition.",
        whyItMatters: "A repeatable endpoint makes each repetition easier to compare.",
        whatToDo: "Go deeper on the next repetition.",
      }],
    }), source)).toThrow(/comfortable.*controlled/i);
    expect(buildWriterCopyPrompt(source)).toContain("as low as feels comfortable while staying controlled");
  });

  it("detects factual rep-count, score, and timestamp contradictions before normalization", () => {
    const raw = decision();
    raw.setSummary.totalReps = 8;
    raw.repTimeline = raw.repTimeline.slice(0, 4);
    raw.score = 58;
    raw.findings[0].evidence[0] = { ...raw.findings[0].evidence[0], repNumber: 1, startMs: 15_000, peakMs: 16_500, endMs: 17_000 };

    expect(detectRawFactualContradictions(raw, 25_020).map((item) => item.kind)).toEqual(
      expect.arrayContaining(["rep_count", "score", "timestamp"]),
    );
  });

  it("treats observed exercise movement as a contradiction to an unable decision", () => {
    const raw = {
      ...decision(),
      status: "unable",
      videoCheck: {
        outcome: "unable",
        usableObservations: [],
        limitations: ["The camera is low."],
        retryReason: "No usable movement.",
        retryInstruction: "Record again.",
        movementPresence: [
          { position: "beginning", startMs: 0, endMs: 4_000, observedMovement: false, observation: "Only setup is visible." },
          { position: "middle", startMs: 10_000, endMs: 14_000, observedMovement: true, observation: "The dumbbell moves away from and back toward the torso." },
          { position: "end", startMs: 20_000, endMs: 24_000, observedMovement: false, observation: "The set has ended." },
        ],
      },
    };

    expect(detectRawFactualContradictions(raw, 25_020)).toContainEqual(expect.objectContaining({
      kind: "status",
      startMs: 10_000,
      endMs: 14_000,
    }));
    expect((ANALYSIS_DECISION_SCHEMA.properties.videoCheck as any).required).toContain("movementPresence");
  });

  it("parses semantic contradiction flags and targets only their nearby video segments", () => {
    const source = parseAnalysisDecision(decision(), 25_020);
    const audit = parseWriterAuditResponse({
      coaching: writerPatch(),
      contradictions: [{
        kind: "coaching",
        findingId: "tempo-loss",
        startMs: 15_000,
        endMs: 17_000,
        description: "The coaching says the return is slow while the observation says it speeds up.",
      }],
    }, source, 25_020);
    const windows = targetedReviewWindows(source, audit.contradictions, 25_020);

    expect(windows).toEqual([{ startMs: 13_500, endMs: 18_500 }]);
    expect(buildTargetedContradictionReviewPrompt(source, audit.coaching, audit.contradictions)).toContain("Only the supplied disputed clips");
  });

  it("canonicalizes muscle names instead of trusting an unrelated writer region", () => {
    const source = parseAnalysisDecision(decision(), 25_020);
    const patch = parseWriterCopyPatch(writerPatch({
      muscleFocus: {
        primary: [{ name: "Pectoralis major", region: "quads" }],
        secondary: [{ name: "Rotator cuff", region: "front_shoulders" }],
        unclassified: [],
      },
    }), source);

    expect(patch.muscleFocus).toEqual({
      primary: [{ name: "Pectoralis major", region: "chest" }],
      secondary: [],
      unclassified: ["Rotator cuff"],
    });
  });

  it("uses a compact writer contract for personalized full-set coaching", () => {
    expect(WRITER_COPY_SCHEMA.required).toEqual(["overallAssessment", "muscleFocus", "coachNote", "findings"]);
    expect(WRITER_COPY_SCHEMA.properties).not.toHaveProperty("nextSetPlan");
    expect(WRITER_COPY_SCHEMA.properties).not.toHaveProperty("equipmentObservations");
    expect(WRITER_COPY_SCHEMA.properties.muscleFocus).toMatchObject({
      type: "object",
      required: ["primary", "secondary"],
    });

    const prompt = buildWriterCopyPrompt(parseAnalysisDecision(decision(), 25_020, declaredBench));
    expect(prompt).toContain("one or two sentences totaling no more than 45 words");
    expect(prompt).toContain("exactly one personalized sentence totaling no more than 24 words");
    expect(prompt).toContain("recommended range of one to three sentences");
    expect(prompt).toContain("recommended range of two to three sentences");
    expect(prompt).toContain("recommended range of one to two sentences");
    expect(prompt).toContain("beginning, middle, and end");
    expect(prompt).toContain("say exactly what the person visibly did");
    expect(prompt).toContain("These ranges are guidance, not truncation rules");
    expect(prompt).toContain("complete grammatical sentences");
    expect(prompt).toContain("calm and candid");
    expect(prompt).toContain("not nagging");
    expect(prompt).toContain("Do not repeat the observation");
  });

  it("uses one combined model response for factual analysis and final coaching", () => {
    expect(COMBINED_ANALYSIS_SCHEMA.required).toEqual(["analysis", "coaching"]);
    expect(COMBINED_ANALYSIS_SCHEMA.properties.analysis).toBe(ANALYSIS_DECISION_SCHEMA);
    expect(ANALYSIS_DECISION_SCHEMA.required).toContain("movementScores");
    expect(ANALYSIS_DECISION_SCHEMA.properties.movementScores).toMatchObject({
      anyOf: [
        { type: "array", maxItems: 0 },
        { type: "array", minItems: 3, maxItems: 5 },
      ],
    });

    const prompt = buildCombinedAnalysisPrompt(25_020, declaredBench);
    expect(prompt).toContain("one top-level object with analysis and coaching fields");
    expect(prompt).toContain("equipment or handle");
    expect(prompt).toContain("beginning-to-end changes");
    expect(prompt).toContain("exercise-specific score categories");

    const parsed = parseCombinedAnalysisResponse({
      analysis: decision(),
      coaching: writerPatch(),
    }, 25_020, declaredBench);
    expect(parsed.decision.score).toBe(82);
    expect(parsed.writerCopy?.coachNote).toBe(writerPatch().coachNote);
  });

  it("requires three to five distinct exercise-specific score categories for usable video", () => {
    const withoutScores = { ...decision(), movementScores: [] };
    expect(() => parseAnalysisDecision(withoutScores, 25_020, declaredBench)).toThrow(/three to five/i);

    const duplicateLabels = {
      ...decision(),
      movementScores: [
        { id: "path", label: "Dumbbell Path", score: 88, observed: "The path stays centered.", evidenceIds: [] },
        { id: "path-two", label: "Dumbbell Path", score: 84, observed: "The path remains visible.", evidenceIds: [] },
        { id: "tempo", label: "Tempo", score: 90, observed: "The tempo stays controlled.", evidenceIds: [] },
      ],
    };
    expect(() => parseAnalysisDecision(duplicateLabels, 25_020, declaredBench)).toThrow(/labels must be unique/i);
  });

  it("rejects combined coaching that exceeds the compact copy limits", () => {
    const source = parseAnalysisDecision(decision(), 25_020);
    expect(() => parseWriterCopyPatch(writerPatch({
      overallAssessment: "The first sentence describes the set. The second sentence adds context. The third sentence is not allowed.",
    }), source)).toThrow(/one or two sentences/i);
    expect(() => parseWriterCopyPatch(writerPatch({
      coachNote: "Keep your base steady. Match the final lowering phase to the first.",
    }), source)).toThrow(/exactly one sentence/i);
    expect(() => parseWriterCopyPatch(writerPatch({
      coachNote: Array.from({ length: 25 }, (_, index) => `word${index + 1}`).join(" ") + ".",
    }), source)).toThrow(/24 words/i);
  });

  it("downgrades unsupported recurrence claims to their single visible evidence moment", () => {
    const source = decision();
    const [correction, strength] = source.findings;
    const { findings: _findings, ...base } = source;
    const analysis = {
      ...base,
      corrections: [
        correction,
        { ...correction, id: "range-note" },
        { ...correction, id: "setup-note" },
        { ...correction, id: "grip-note" },
      ],
      strengths: [{
        ...strength,
        detail: "The lifter maintains smooth cadence throughout the lifting and lowering phases.",
        evidence: [{
          ...strength.evidence[0],
          visualEvidence: "Torso remains vertical and steady across all reps.",
        }],
      }],
      cues: [],
    };

    const parsed = parseCombinedAnalysisResponse({
      analysis,
      coaching: writerPatch({
        findings: analysis.corrections.map((item: any) => ({
          findingId: item.id,
          title: item.title,
          whatHappened: item.detail,
          whyItMatters: item.whyItMatters,
          whatToDo: item.correction,
        })),
      }),
    }, 25_020);

    expect(parsed.decision.findings.find((finding) => finding.kind === "strength")?.detail)
      .toBe("Torso remains vertical and steady at the cited moment.");
  });

  it("rejects hidden force, protection, optimization, and numeric-angle claims in final coaching copy", () => {
    const source = parseAnalysisDecision(decision(), 25_020);
    expect(() => parseWriterCopyPatch(writerPatch({
      findings: [{
        ...writerPatch().findings[0],
        whatToDo: "Move your elbow forward about 30 degrees before lowering.",
      }],
    }), source)).toThrow(/unsupported coaching language/i);

    expect(() => parseCombinedAnalysisResponse({
      analysis: decision(),
      coaching: writerPatch({
        findings: [{
          findingId: "tempo-loss",
          title: "Match the lowering pace",
          whatHappened: "The knee reaches ninety degrees at the bottom.",
          whyItMatters: "An even pace keeps the visible path repeatable.",
          whatToDo: "Make the final lowering phase match the first.",
        }],
      }),
    }, 25_020)).toThrow(/unsupported visible-movement claim/i);

    expect(() => parseCombinedAnalysisResponse({
      analysis: decision(),
      coaching: writerPatch({
        findings: [{
          findingId: "tempo-loss",
          title: "Match the lowering pace",
          whatHappened: "The dumbbell moves down faster at the cited moment.",
          whyItMatters: "An even pace distributes force and protects joint stability.",
          whatToDo: "Make the final lowering phase match the first.",
        }],
      }),
    }, 25_020)).toThrow(/unsupported visible-movement claim/i);
  });

  it("gives the writer its exact validation failure when repairing rejected coaching", () => {
    const source = parseAnalysisDecision(decision(), 25_020);
    const prompt = buildWriterCopyRepairPrompt(source, writerPatch(), new Error("writer copy coachNote contains unsupported coaching language"));

    expect(prompt).toContain("coachNote contains unsupported coaching language");
    expect(prompt).toContain("Rewrite the complete JSON object");
    expect(prompt).toContain('"findingId":"tempo-loss"');
  });

  it("constrains writer finding IDs to the immutable correction inventory", () => {
    const source = parseAnalysisDecision(decision(), 25_020);
    const schema = writerCopySchema(source) as any;

    expect(schema.properties.findings.items.properties.findingId.enum).toEqual(["tempo-loss"]);
  });

  it("ranks corrections by severity, recurrence, and stable source order", () => {
    const source = decision().findings[0];
    const ranked = rankCorrections([
      { ...source, id: "note", severity: "note" },
      { ...source, id: "important-isolated", severity: "important" },
      { ...source, id: "high", severity: "high" },
      { ...source, id: "important-recurring", severity: "important", evidence: [source.evidence[0], { ...source.evidence[0], peakMs: 12_000 }] },
    ]);

    expect(ranked.map((finding) => finding.id)).toEqual([
      "high",
      "important-recurring",
      "important-isolated",
      "note",
    ]);
  });

  it("preserves four supported corrections through writer copy and derived next-set actions", () => {
    const raw = decision();
    const correction = raw.findings[0];
    raw.findings = [
      correction,
      { ...correction, id: "path", title: "Keep the dumbbell path close" },
      { ...correction, id: "torso", title: "Keep the torso steady", severity: "high" },
      { ...correction, id: "endpoint", title: "Match the bottom position", severity: "note" },
      raw.findings[1],
    ];
    const source = parseAnalysisDecision(raw, 25_020);
    const patch = parseWriterCopyPatch(writerPatch({
      findings: raw.findings.slice(0, 4).map((finding: any) => ({
        findingId: finding.id,
        title: finding.title,
        whatHappened: `The visible ${finding.id} position changes near the end of the set.`,
        whyItMatters: "A repeatable visible position keeps the movement consistent. The late change makes the ending differ from the beginning.",
        whatToDo: `Keep the ${finding.id} position matched from beginning to end.`,
      })),
    }), source);
    const merged = mergeWriterCopy(source, patch);

    expect(merged.priorityCorrections).toHaveLength(4);
    expect(merged.nextSetPlan).toHaveLength(4);
    expect(merged.priorityCorrections.map((finding) => finding.id)).toEqual(["torso", "tempo-loss", "path", "endpoint"]);
    expect(merged.nextSetPlan.map((item) => item.relatedFindingId)).toEqual(["torso", "tempo-loss", "path", "endpoint"]);
  });

  it("treats declared exercise, amount, load, style, and focus as authoritative", () => {
    const prompt = buildSinglePassAnalysisPrompt(25_020, declaredBench);
    expect(prompt).toContain("The user performed Dumbbell Bench Press for 8 reps");
    expect(prompt).toContain("authoritative");
    expect(prompt).toContain("40 lb per hand");
    expect(prompt).toContain("paused");
    expect(prompt).toContain("Watch my left shoulder");
    expect(prompt).toContain("gravity, camera height, oblique projection");
    expect(prompt).not.toContain("DECLARED_CONTEXT_MISMATCH");
    expect(prompt).toContain("Never reject the user's declaration");
    expect(prompt).toContain("Do not identify or rename the exercise");
    expect(prompt).not.toContain("identify the exercise only from the completed movement record");
  });

  it("prevents the model from renaming the exercise or replacing the declared rep count", () => {
    const source = decision();
    source.recognition.label = "Incline Dumbbell Press";
    source.recognition.catalogExerciseId = null;
    source.setSummary.totalReps = 4;
    const parsed = parseAnalysisDecision(source, 25_020, declaredBench);
    expect(parsed.recognition).toMatchObject({
      label: "Dumbbell Bench Press",
      catalogExerciseId: 3,
      confidence: 1,
      alternatives: [],
      source: "user_declared",
    });
    expect(parsed.setSummary.totalReps).toBe(8);
  });

  it("normalizes a model-supplied catalog id before applying the authoritative declaration", () => {
    const source = decision();
    source.recognition.catalogExerciseId = 999;

    expect(parseAnalysisDecision(source, 25_020).recognition.catalogExerciseId).toBeNull();
    expect(parseAnalysisDecision(source, 25_020, declaredBench).recognition.catalogExerciseId).toBe(3);
  });

  it("keeps legacy clean-set decisions readable without inventing a correction plan", () => {
    const source = decision();
    source.findings = source.findings.filter((finding: any) => finding.kind === "strength");
    source.nextSetPlan = [];
    source.scoreRationale = source.scoreRationale.map((item: any) => ({ ...item, assessment: "strong", evidenceIds: [] }));
    const parsed = parseAnalysisDecision(source, 25_020, declaredBench);
    const patch = parseWriterCopyPatch(writerPatch({ findings: [] }), parsed);
    const merged = mergeWriterCopy(parsed, patch);
    expect(parsed.nextSetPlan).toEqual([]);
    expect(merged.priorityCorrections).toEqual([]);
    expect(merged.nextSetPlan).toEqual([]);
  });

  it("rejects a model attempt to override the authoritative declaration as retryable invalid output", () => {
    const source = decision();
    source.status = "unable";
    source.findings = [];
    source.score = null;
    source.scoreRationale = [];
    source.wholeSetCoverage = null;
    source.movementAnalysis = null;
    source.nextSetPlan = [];
    source.repTimeline = [];
    source.videoCheck = {
      outcome: "unable",
      usableObservations: ["The person repeatedly squats while standing."],
      limitations: [],
      retryReason: "DECLARED_CONTEXT_MISMATCH: the video shows standing squats, not a bench press.",
      retryInstruction: "Correct the declared exercise.",
    };
    expect(() => parseAnalysisDecision(source, 25_020, declaredBench)).toThrow("DECLARED_CONTEXT_MISMATCH");
    expect(analysisValidationFailureCode(new Error("DECLARED_CONTEXT_MISMATCH"))).toBe("ANALYSIS_INVALID_RESPONSE");
  });

  it("maps parser details to bounded validation codes without exposing raw output", () => {
    expect(analysisValidationFailureCode(new Error("wholeSetCoverage requires exactly three checkpoints"))).toBe("ANALYSIS_INVALID_COVERAGE");
    expect(analysisValidationFailureCode(new Error("findings[0].evidence leaves the recording"))).toBe("ANALYSIS_INVALID_EVIDENCE_RANGE");
    expect(analysisValidationFailureCode(new Error("findings[0].primaryEvidenceIndex must be between 0 and 1"))).toBe("ANALYSIS_INVALID_EVIDENCE_PRIMARY");
    expect(analysisValidationFailureCode(new Error("scoreRationale malformed"))).toBe("ANALYSIS_INVALID_SCORE");
    expect(analysisValidationFailureCode(new Error("unexpected parser issue"))).toBe("ANALYSIS_INVALID_RESPONSE");
  });

  it("asks the sole analyst for every visible mistake with lenient temporal evidence", () => {
    const prompt = buildSinglePassAnalysisPrompt(25_020);
    expect(prompt).toContain("every distinct clearly visible mistake");
    expect(prompt).toContain("neighboring sampled frames");
    expect(prompt).toContain("exact single frame");
    expect(prompt).toContain("clearest maximum visible deviation");
    expect(prompt).toContain("startMs and endMs are context boundaries only");
    expect(prompt).toContain("Never default peakMs to startMs or endMs");
    expect(prompt).toContain("all five scoring dimensions exactly once");
    expect(prompt).toContain("high-, medium-, and low-confidence");
    expect(prompt).toContain("Build one ranked correction inventory");
    expect(prompt).toContain("Four is a minimum, not a maximum");
    expect(prompt).toContain("Every complete or partial result must contain at least four distinct evidence-backed corrections");
    expect(prompt).toContain("A category label never permits evidence from outside a real repetition");
    expect(prompt).toContain("optional exercise-specific advice");
    expect(prompt).toContain("genuinely visible in-rep stance, posture, grip, support, balance, path, range, tempo, and control");
    expect(prompt).toContain("every distinct evidence-backed problem");
    expect(prompt).toContain("complete active exercise");
    expect(prompt).toContain("wholeSetCoverage");
    expect(prompt).toContain("beginning, middle, and end");
    expect(prompt.indexOf("wholeSetCoverage")).toBeLessThan(prompt.indexOf("Build one ranked correction inventory"));
    expect(prompt).not.toContain("second full-video sweep");
    expect(prompt).not.toContain("coverage target, not a minimum");
    expect(prompt).toContain("in-rep stance and posture");
    expect(prompt).toContain("concentric motion, endpoints, eccentric motion, transitions between real repetitions");
    expect(prompt).toContain("Build repTimeline only when");
    expect(prompt).toContain("short evidence window");
    expect(prompt).toContain("4,000 ms");
    expect(prompt).toContain("Retain note-level deviations");
    expect(prompt).toContain("Do not stop after finding one obvious issue");
    expect(prompt).toContain("at least four distinct evidence-backed corrections");
    expect(prompt).toContain("in-rep body position");
    expect(prompt).toContain("grip");
    expect(prompt).toContain("safety problem that the exercise repetitions do not show");
    expect(prompt).toContain("If the active exercise cannot support four honest corrections");
    expect(prompt).toContain("Use evidence-backed strengths only for visible positives");
    expect(prompt).toContain("return unable with a specific recording instruction");
    expect(prompt).toContain("alignment, path, endpoints, range, tempo, stability, control, and side-to-side symmetry");
    expect(prompt).toContain("continuous active-set interval");
    expect(prompt).toContain("setting the implement down");
    expect(prompt).toContain("outside that interval");
    expect(prompt).toContain("timestamps, movement phases, and beginning/middle/end language");
    expect(prompt).not.toContain("reject each close alternative");
    expect(prompt).not.toContain("exercise candidates");
    expect(prompt).toContain("Never turn sitting down, standing up, walking, repositioning");
    expect(prompt).toContain("Never invent a deviation");
    expect(prompt).not.toContain("largest visible limiter");
    expect(prompt).not.toContain("primaryCorrectionId");
    expect(prompt).not.toContain("ordered by coaching priority");
    expect(prompt).not.toContain("single still at peakMs must independently show");
    expect(prompt).not.toContain("Every correction ID must appear");
  });

  it("requires whole-video evidence and semantic alignment before any advice", () => {
    const prompt = buildSinglePassAnalysisPrompt(25_020, declaredBench);
    const activeSet = prompt.indexOf("first real repetition through the end of the last real repetition");
    const trackedRecord = prompt.indexOf("Record the observed path, endpoints, range, tempo, stability");
    const corrections = prompt.indexOf("Build one ranked correction inventory");

    expect(activeSet).toBeGreaterThan(-1);
    expect(trackedRecord).toBeGreaterThan(activeSet);
    expect(corrections).toBeGreaterThan(trackedRecord);
    expect(prompt).toContain("separated supporting moments");
    expect(prompt).toContain("one evidence moment supports only one isolated or uncertain occurrence");
    expect(prompt).toContain("title, detail, evidence, and correction");
    expect(prompt).toContain("later coaching writer turns this factual inventory into the three carousel tabs");
    expect(prompt).toContain("same visible body, implement, equipment, setup, load, support, or surroundings relationship");
    expect(prompt).toContain("A hip-directed cue requires an observed implement path or endpoint problem");
    expect(prompt).toContain("Elbow flare requires visible evidence about the elbow's distance from the torso");
    expect(prompt).toContain("Do not label an endpoint or path problem as elbow flare");
    expect(prompt).toContain('use "Dumbbell Finishes Forward of the Hip" rather than "Guide the Elbow Toward the Hip."');
    expect(prompt).toContain("Evidence count determines temporal scope");
    expect(prompt).toContain("one evidence moment supports only one isolated or uncertain occurrence");
    expect(prompt).toContain("only then write the detail");
    expect(prompt).toContain("Path example:");
    expect(prompt).toContain("Joint-alignment example:");
    expect(prompt).toContain("Range example:");
    expect(prompt).toContain("Stability example:");
    expect(prompt).toContain("Tempo example:");
    expect(prompt).toContain('replace "maintain tension" with the visible benefit');
    expect(prompt).toContain("scan every user-facing field, including strengths, score observations");
    expect(prompt).toContain("state both (a) the intended visible endpoint relationship");
    expect(prompt).toContain("Use this universal path decision gate before scoring path");
    expect(prompt).toContain("Consistency does not make a mismatched path correct");
    expect(prompt).toContain("Call path a strength only when both its repeatability and its endpoint relationship match");
    expect(prompt).toContain("cannot be omitted while path is praised as a strength");
    expect(prompt).toContain("Do not estimate degrees or numeric joint or torso angles");
    expect(prompt).toContain("including strengths, score observations, summaries, rationales, and cues");
    expect(prompt).toContain('replace "peak contraction" with "top endpoint');
    expect(prompt).toContain("One representative frame never proves a whole-set strength");
    expect(prompt).toContain("requires at least two separated evidence moments in that strength's own evidence array");
  });

  it("generates movement scores while preserving observed issue regions", () => {
    const properties = ANALYSIS_DECISION_SCHEMA.properties as any;
    const finding = ANALYSIS_DECISION_SCHEMA.$defs.finding as any;
    expect(ANALYSIS_DECISION_SCHEMA.required).toContain("movementScores");
    expect(properties).toHaveProperty("movementScores");
    expect(finding.required).toContain("observedIssueRegions");
    expect(finding.properties.observedIssueRegions.items.enum).toContain("elbows");

    const raw = decision();
    raw.movementScores = [
      { id: "dumbbell-path", label: "Dumbbell Path", score: 68, observed: "The dumbbell rises toward the ribs before finishing closer to the hip late in the set.", evidenceIds: ["tempo-loss"] },
      { id: "torso-control", label: "Torso Control", score: 82, observed: "The planted base stays steady across the visible repetitions.", evidenceIds: ["stable-base"] },
      { id: "lowering-control", label: "Lowering Control", score: 61, observed: "The final lowering phase is faster than the opening phase.", evidenceIds: ["tempo-loss"] },
    ];
    raw.findings[0].observedIssueRegions = ["elbows", "upper_back"];
    raw.findings[1].observedIssueRegions = [];

    const parsed = parseAnalysisDecision(raw, 25_020);
    expect(parsed.movementScores.map((item) => item.label)).toEqual(["Dumbbell Path", "Torso Control", "Lowering Control"]);
    expect(parsed.findings[0].observedIssueRegions).toEqual(["elbows", "upper_back"]);
  });

  it("requires new movement scores while safely cleaning stale evidence references", () => {
    const missingScores = decision();
    missingScores.movementScores = [];
    expect(() => parseAnalysisDecision(missingScores, 25_020)).toThrow(/three to five/i);

    const unsupportedScore = decision();
    unsupportedScore.movementScores[0].evidenceIds = ["missing-finding"];
    expect(parseAnalysisDecision(unsupportedScore, 25_020).movementScores[0].evidenceIds).toEqual([]);
  });

  it("uses the declaration while observing the whole biomechanical movement", () => {
    const prompt = buildSinglePassAnalysisPrompt(25_020, declaredBench);
    expect(prompt).toContain("application metadata, not analyst duties");
    expect(prompt).toContain("Do not identify or rename the exercise");
    expect(prompt).toContain("load direction, implement path, joint actions, moving body segments, range, and reversal points");
    expect(prompt).toContain("movementAnalysis");
    expect(prompt).toContain("proximal and distal body segments");
    expect(prompt).toContain("largest repeated body-segment and implement displacement");
    expect(prompt).not.toContain("exercise candidates");
    expect(prompt.indexOf("movementAnalysis")).toBeLessThan(prompt.indexOf("Build one ranked correction inventory"));
  });

  it("places full-set coverage before movement evidence and omits recognition output", () => {
    const propertyOrder = Object.keys(ANALYSIS_DECISION_SCHEMA.properties);
    expect(propertyOrder.indexOf("wholeSetCoverage")).toBeLessThan(propertyOrder.indexOf("movementAnalysis"));
    expect(propertyOrder).not.toContain("recognition");
    expect(ANALYSIS_DECISION_SCHEMA.properties.movementAnalysis).toMatchObject({
      type: ["string", "null"],
    });
  });

  it("accepts all supported corrections without requiring the analyst to rank them", () => {
    const source = decision();
    source.findings.splice(0, 0, {
      ...source.findings[0],
      id: "elbow-path",
      title: "Keep the elbow path repeatable",
    });
    expect(parseAnalysisDecision(source, 25_020).findings.map((finding) => finding.id)).toEqual([
      "elbow-path",
      "tempo-loss",
      "stable-base",
    ]);
  });

  it("requires a movement-presence check before declaring a recording unable", () => {
    const prompt = buildSinglePassAnalysisPrompt(25_020);
    expect(prompt).toContain("Before returning unable");
    expect(prompt).toContain("beginning, middle, and end");
    expect(prompt).toContain("repeated implement displacement");
    expect(prompt).toContain("cannot return unable merely because the implement starts or ends on a rack");
    expect(prompt).toContain("stationary rack supports");
    expect(prompt).toContain("hand-held implement");
  });

  it("hydrates public identity and completed amount from the declaration", () => {
    const source = decision();
    delete source.recognition;
    delete source.setSummary;
    delete source.repTimeline;
    const parsed = parseAnalysisDecision(source, 25_020, declaredBench);
    expect(parsed.recognition.label).toBe("Dumbbell Bench Press");
    expect(parsed.recognition.source).toBe("user_declared");
    expect(parsed.setSummary.totalReps).toBe(8);
    expect(parsed.repTimeline).toEqual([]);
  });

  it("scores visible execution by demonstrated severity instead of correction count or camera limits", () => {
    const prompt = buildSinglePassAnalysisPrompt(25_020);
    expect(prompt).toContain("Do not lower the score merely because you found more corrections");
    expect(prompt).toContain("Do not deduct points for camera angle, occlusion, or a limited dimension");
    expect(prompt).toContain("80-89: good execution");
    expect(prompt).toContain("one recurring moderate limiter");
    expect(prompt).toContain("70-79: multiple important recurring problems or one major repeated breakdown");
    expect(prompt).toContain("Low-confidence and note-level suggestions should have little or no effect on the score");
    expect(prompt).toContain("Never use 60-69 unless at least two high-severity problems repeat");
    expect(prompt).toContain("one important correction plus note-level corrections, use 76 as the minimum");
    expect(prompt).toContain("two or more recurring important corrections but no high-severity correction, use 70 as the minimum");
    expect(prompt).toContain("only note-level corrections, use 82 as the minimum");
    expect(prompt).toContain("Long pauses between repetitions");
    expect(prompt).toContain("must not strongly lower the form score");
    expect(prompt).toContain("Rest between completed repetitions is not a technique error");
    expect(prompt).toContain("Never create a correction whose main subject is pause duration");
    expect(prompt).toContain("Never use rest duration or between-rep cadence as scoring evidence");
    expect(prompt).toContain("FINAL NUMERIC SELF-CHECK");
    expect(prompt).toContain("If no correction has severity high, score cannot be below 70");
    expect(prompt.indexOf("FINAL NUMERIC SELF-CHECK")).toBeGreaterThan(prompt.indexOf("Return all five scoring dimensions exactly once"));
  });

  it("keeps writer explanations inside visible movement claims", () => {
    const prompt = buildWriterCopyPrompt(parseAnalysisDecision(decision(), 25_020));
    expect(prompt).toContain("visible steadiness, repeatability, position, range, control, and path");
    expect(prompt).toContain("muscle activation");
    expect(prompt).toContain("muscle isolation");
    expect(prompt).toContain("internal force");
    expect(prompt).toContain("load distribution");
    expect(prompt).toContain("whatHappened");
    expect(prompt).toContain("whyItMatters");
    expect(prompt).toContain("whatToDo");
    expect(prompt).toContain("one clear cue");
    expect(prompt).toContain("helpful trainer talking to a person at the gym");
    expect(prompt).toContain("Do not use biomechanics jargon");
    expect(prompt).toContain("lifting and lowering");
    expect(prompt).toContain("a beginner can understand on the first read");
    expect(prompt).toContain("candid");
    expect(prompt).toContain("Do not add recurrence");
    expect(prompt).toContain("Count the immutable evidence moments before choosing temporal wording");
    expect(prompt).toContain("Removing unsupported temporal scope does not contradict the finding");
    expect(prompt).toContain("must not be an instruction, command, or cue");
    expect(prompt).toContain("For lowering tempo, never say it maintains tension or increases muscle benefit");
    expect(prompt).toContain("Before returning JSON, scan overallAssessment, coachNote");
    expect(prompt).toContain("actual weight or equipment");
    expect(prompt).toContain("without repetition");
    expect(prompt).toContain("Do not add, remove, merge, or contradict corrections");
    expect(prompt).not.toContain("preventive or optimization advice");
  });

  it("restricts analysis to exercise movement inside the active-set interval", () => {
    const prompt = buildSinglePassAnalysisPrompt(25_020);
    expect(prompt).toContain("Ignore every non-exercise-specific movement and action outside that interval");
    expect(prompt).not.toContain("Analyze setup, every visible repetition");
    expect(prompt).not.toContain("surroundings and setup audit");
    expect(ANALYSIS_DECISION_SCHEMA.required).toContain("equipmentObservations");
  });

  it("keeps analyst-owned setup evidence outside the coaching writer contract", () => {
    const raw = decision();
    raw.equipmentObservations = [{
      id: "bench-angle",
      category: "setup",
      title: "Bench setup",
      observation: "The bench is angled while the right foot stays behind the left foot.",
      coachingRelevance: "Square the stance before the next set so the support position is easier to repeat.",
      load: null,
      evidence: [{
        startMs: 4_100,
        peakMs: 4_300,
        endMs: 4_600,
        visualEvidence: "The bench edge and both feet are clear at this moment.",
        visibleReferences: ["bench edge", "left foot", "right foot"],
        confidence: 0.91,
        focusRegion: null,
      }],
    }];
    const source = parseAnalysisDecision(raw, 25_020);
    const patch = parseWriterCopyPatch(writerPatch(), source);
    const merged = mergeWriterCopy(source, patch);

    expect(merged.equipmentObservations[0].observation).toBe("The bench is angled while the right foot stays behind the left foot.");
    expect(merged.equipmentObservations[0].evidence[0].peakMs).toBe(4_300);
    expect(merged.equipmentObservations[0].evidence[0].visibleReferences).toEqual(["bench edge", "left foot", "right foot"]);
  });

  it("does not persist bodyweight setup as an exact external load", () => {
    const raw = decision();
    raw.equipmentObservations = [{
      id: "bodyweight-setup",
      category: "setup",
      title: "Bodyweight setup",
      observation: "The athlete is standing without external resistance.",
      coachingRelevance: "The setup is clear.",
      load: {
        value: null,
        unit: null,
        scope: "bodyweight",
        certainty: "exact_visible",
        basis: "not_readable",
      },
      evidence: [{
        startMs: 4_100,
        peakMs: 4_800,
        endMs: 5_600,
        visualEvidence: "No external resistance is visible.",
        visibleReferences: ["hands", "torso"],
        confidence: 0.92,
        focusRegion: null,
      }],
    }];

    const parsed = parseAnalysisDecision(raw, 25_020);

    expect(parsed.equipmentObservations).toHaveLength(1);
    expect(parsed.equipmentObservations[0].load).toBeNull();
  });

  it("forces a same-phase whole-set comparison before assigning severity or praise", () => {
    const prompt = buildSinglePassAnalysisPrompt(25_020);
    expect(prompt).toContain("equivalent phases across at least three repetitions");
    expect(prompt).toContain("torso and shoulder orientation");
    expect(prompt).toContain("cannot be severity note");
    expect(prompt).toContain("isolated and slight");
    expect(prompt).toContain("Do not apply a global upper cap");
  });

  it("makes the single analyst audit the actual elbow and implement endpoint", () => {
    const prompt = buildSinglePassAnalysisPrompt(25_020);

    expect(prompt).toContain("Watch the complete original recording");
    expect(prompt).toContain("working elbow");
    expect(prompt).toContain("implement");
    expect(prompt).toContain("stable scene references");
    expect(prompt).toContain("smooth, controlled path can still be mechanically wrong");
    expect(prompt).toContain("straight upward");
    expect(prompt).toContain("hip");
    expect(prompt).toContain("Try to falsify every proposed path strength");
  });

  it("assigns the whole-set summary to the writer instead of the analyst", () => {
    const analystPrompt = buildSinglePassAnalysisPrompt(25_020);
    const writerPrompt = buildWriterCopyPrompt(parseAnalysisDecision(decision(), 25_020));
    expect(analystPrompt).not.toContain("Set Summary");
    expect(writerPrompt).toContain("whole-set summary");
    expect(writerPrompt).toContain("one or two sentences totaling no more than 45 words");
  });

  it("accepts one or two summary sentences and rejects a third", () => {
    const source = parseAnalysisDecision(decision(), 25_020);
    expect(parseWriterCopyPatch(writerPatch({
      overallAssessment: "The row keeps a planted base, but the dumbbell returns faster near the end.",
    }), source).overallAssessment).toContain("planted base");
    expect(parseWriterCopyPatch(writerPatch({
      overallAssessment: "The row keeps a planted base throughout the set. The dumbbell returns faster near the end, so match the last lowering phase to the first.",
    }), source).overallAssessment).toContain("throughout the set");
    expect(() => parseWriterCopyPatch(writerPatch({
      overallAssessment: "The base stays planted. The first return is controlled. The last return is faster.",
    }), source)).toThrow(/one or two sentences/i);
  });

  it("normalizes analyst internal-state wording and rejects it from writer copy", () => {
    const analyst = decision();
    analyst.findings[0].title = "Torso Rotation at Peak Contraction";
    analyst.findings[0].detail = "The working arm fully relaxes at the bottom.";
    analyst.findings[0].whyItMatters = "This optimizes force transmission, protects the joint, and improves target engagement.";
    analyst.findings[0].evidence[0].visualEvidence = "The knee reaches ninety degrees at the cited moment.";
    analyst.findings[0].cue = "Keep wrist relaxed.";
    const parsedAnalyst = parseAnalysisDecision(analyst, 25_020);
    expect(parsedAnalyst.findings[0].detail).toContain("moves lower");
    expect(parsedAnalyst.findings[0].title).toBe("Torso Rotation at top endpoint");
    expect(parsedAnalyst.findings[0].whyItMatters).not.toMatch(/force|protect|optimiz|engagement/i);
    expect(parsedAnalyst.findings[0].evidence[0].visualEvidence).not.toMatch(/ninety|degrees/i);
    expect(parsedAnalyst.findings[0].cue).toBe("Keep wrist steady.");
    expect(parsedAnalyst.findings[0].detail).not.toMatch(/relax|engag|tension|muscle/i);

    const source = parseAnalysisDecision(decision(), 25_020);
    expect(() => parseWriterCopyPatch(writerPatch({
      findings: [{
        findingId: "tempo-loss",
        title: "Control the return",
        whatHappened: "The return becomes faster late in the set.",
        whyItMatters: "A consistent path stays repeatable. Letting your biceps take over changes the movement.",
        whatToDo: "Keep your biceps engaged.",
      }],
    }), source)).toThrow(/unsupported/i);
  });

  it("accepts one complete decision with a model-selected frame", () => {
    const expected = decision();
    expected.findings = expected.findings.map((finding: any) => ({ ...finding, coachingArea: "form" }));
    expect(parseAnalysisDecision(expected, 25_020)).toEqual({ ...expected, score: 82, recognition: { ...expected.recognition, catalogExerciseId: null } });
  });

  it("can validate its persisted immutable decision again during a retry", () => {
    const persisted = parseAnalysisDecision(decision(), 25_020);
    expect(parseAnalysisDecision(JSON.parse(JSON.stringify(persisted)), 25_020)).toEqual(persisted);
  });

  it("rejects missing coverage but normalizes checkpoint order and bounded timing drift", () => {
    const missing = decision() as Record<string, unknown>;
    delete missing.wholeSetCoverage;
    expect(() => parseAnalysisDecision(missing, 25_020)).toThrow(/wholeSetCoverage/i);

    const unordered = decision();
    unordered.wholeSetCoverage.checkpoints[1].position = "end";
    unordered.wholeSetCoverage.checkpoints[2].position = "middle";
    unordered.wholeSetCoverage.checkpoints[0].startMs = 3_750;
    unordered.wholeSetCoverage.checkpoints[2].endMs = 17_900;
    const parsed = parseAnalysisDecision(unordered, 25_020);
    expect(parsed.wholeSetCoverage?.checkpoints.map((checkpoint) => checkpoint.position)).toEqual(["beginning", "middle", "end"]);
    expect(parsed.wholeSetCoverage?.checkpoints[0].startMs).toBe(4_000);
    expect(parsed.wholeSetCoverage?.checkpoints[2].endMs).toBe(17_500);

    const duplicate = decision();
    duplicate.wholeSetCoverage.checkpoints[1].startMs = 4_000;
    duplicate.wholeSetCoverage.checkpoints[1].endMs = 7_500;
    const normalizedDuplicate = parseAnalysisDecision(duplicate, 25_020);
    expect(normalizedDuplicate.wholeSetCoverage?.checkpoints[1].startMs).toBeGreaterThan(
      normalizedDuplicate.wholeSetCoverage?.checkpoints[0].endMs ?? 0,
    );
  });

  it("normalizes overlapping repetitions and clears uncertain counts", () => {
    const overlapping = decision();
    overlapping.repTimeline[1].startMs = 7_000;
    overlapping.repTimeline[1].peakMs = 8_500;
    overlapping.repTimeline[1].endMs = 10_500;

    const parsed = parseAnalysisDecision(overlapping, 25_020);
    expect(parsed.repTimeline).toHaveLength(3);
    expect(parsed.repTimeline[1].repNumber).toBe(3);
    expect(parsed.setSummary.totalReps).toBeNull();
    expect(parsed.setSummary.consistentReps).toBeNull();
  });

  it("drops unsupported findings, cleans their references, and preserves usable analysis", () => {
    const invalidCorrection = decision();
    invalidCorrection.findings[0].evidence[0] = {
      ...invalidCorrection.findings[0].evidence[0],
      startMs: 35_000,
      peakMs: 36_000,
      endMs: 37_000,
    };

    const parsed = parseAnalysisDecision(invalidCorrection, 25_020);
    expect(parsed.findings.map((finding) => finding.id)).toEqual(["stable-base"]);
    expect(parsed.scoreRationale.find((item) => item.criterion === "control_tempo")).toMatchObject({
      assessment: "limited",
      evidenceIds: [],
    });
    expect(parsed.nextSetPlan[0].relatedFindingId).toBeNull();
  });

  it("fills missing scoring dimensions as limited and normalizes duplicate finding IDs", () => {
    const imperfect = decision();
    imperfect.scoreRationale = imperfect.scoreRationale.slice(0, 4);
    imperfect.findings[1].id = "tempo-loss";

    const parsed = parseAnalysisDecision(imperfect, 25_020);
    expect(parsed.scoreRationale).toHaveLength(5);
    expect(parsed.scoreRationale.find((item) => item.criterion === "rep_consistency")).toMatchObject({
      assessment: "limited",
      confidence: 0,
      evidenceIds: [],
    });
    expect(new Set(parsed.findings.map((finding) => finding.id)).size).toBe(parsed.findings.length);
  });

  it("accepts stable checkpoints without requiring a correction in every segment", () => {
    const stable = decision();
    stable.wholeSetCoverage.checkpoints[0].observation = "The base and path stay stable.";
    stable.wholeSetCoverage.checkpoints[1].observation = "The base and path remain stable.";

    const parsed = parseAnalysisDecision(stable, 25_020);

    expect(parsed.wholeSetCoverage?.checkpoints[0].observation).toContain("stable");
    expect(parsed.findings.filter((finding) => finding.kind === "correction")).toHaveLength(1);
  });

  it("exposes the four-problem floor without imposing a correction ceiling", () => {
    const schema = ANALYSIS_DECISION_SCHEMA as any;
    expect(schema.properties.findings).toBeUndefined();
    expect(schema.properties.corrections).toEqual(expect.objectContaining({
      type: ["array", "null"],
      items: { $ref: "#/$defs/finding" },
      description: expect.stringContaining("no invented faults"),
    }));
    expect(schema.properties.corrections.maxItems).toBeUndefined();
    expect(schema.properties.corrections.minItems).toBe(4);
    expect(schema.$defs.finding.required).toContain("coachingArea");
    expect(schema.$defs.finding.required).not.toContain("actionableCorrection");
    expect(schema.required).not.toEqual(expect.arrayContaining(["exerciseGuide", "coachingCoverage"]));
    expect(schema.properties).not.toHaveProperty("exerciseGuide");
    expect(schema.properties).not.toHaveProperty("coachingCoverage");
    expect(schema.properties.strengths.description).toContain("never count toward the four-correction requirement");
    expect(schema.properties.cues.description).toContain("general advice rather than an observed fault");
    expect(schema.required).toEqual(expect.arrayContaining(["wholeSetCoverage", "corrections", "strengths", "cues"]));
    expect(schema.properties.wholeSetCoverage.anyOf[1].properties.checkpoints.minItems).toBe(3);
    expect(schema.properties.wholeSetCoverage.anyOf[1].properties.checkpoints.maxItems).toBe(3);
    expect(schema.properties.scoreRationale.minItems).toBe(5);
    expect(schema.properties.scoreRationale.maxItems).toBe(5);
    expect(schema.properties.score.description).toContain("Minor isolated refinements keep a technically sound set in a strong range");
  });

  it("tells the model to return normalized optional focus coordinates", () => {
    const schema = ANALYSIS_DECISION_SCHEMA as any;
    const focus = schema.$defs.finding.properties.evidence.items.properties.focusRegion.anyOf[1].properties;
    expect(focus.centerX).toMatchObject({ minimum: 0, maximum: 1 });
    expect(focus.centerY).toMatchObject({ minimum: 0, maximum: 1 });
    expect(focus.radius).toMatchObject({ minimum: 0.06, maximum: 0.3 });
    expect(focus.arrowFromX).toMatchObject({ minimum: 0, maximum: 1 });
    expect(focus.arrowFromY).toMatchObject({ minimum: 0, maximum: 1 });
  });

  it("normalizes the model correction inventory into the persisted findings shape", () => {
    const source = decision();
    const [correction, strength] = source.findings;
    const { findings: _findings, ...base } = source;
    const raw = {
      ...base,
      corrections: [
        correction,
        { ...correction, id: "small-range-opportunity", title: "Match the bottom position" },
        { ...correction, id: "small-transition-opportunity", title: "Reset before each pull" },
        { ...correction, id: "small-setup-opportunity", title: "Match the starting position" },
      ],
      strengths: [strength],
      cues: [],
    };

    const parsed = parseAnalysisDecision(raw, 25_020);
    expect(parsed.findings.map((finding) => finding.id)).toEqual([
      "tempo-loss",
      "small-range-opportunity",
      "small-transition-opportunity",
      "small-setup-opportunity",
      "stable-base",
    ]);
    expect(parsed.findings.filter((finding) => finding.kind === "correction")).toHaveLength(4);
  });

  it("ignores a duplicated legacy findings key when dedicated inventories are present", () => {
    const source = decision();
    const [correction, strength] = source.findings;
    const { findings, ...base } = source;
    const parsed = parseAnalysisDecision({
      ...base,
      findings,
      corrections: [
        correction,
        { ...correction, id: "second-correction" },
        { ...correction, id: "third-correction" },
        { ...correction, id: "fourth-correction" },
      ],
      strengths: [strength],
      cues: [],
    }, 25_020);
    expect(parsed.findings.map((finding) => finding.id)).toEqual([
      "tempo-loss",
      "second-correction",
      "third-correction",
      "fourth-correction",
      "stable-base",
    ]);
  });

  it("normalizes bounded evidence drift without discarding otherwise supported advice", () => {
    const drifted = decision();
    drifted.findings[0].evidence[0].confidence = 0.2;
    drifted.findings[0].evidence[0].phase = "lowering";
    drifted.findings[0].evidence[0].visibleBodyAreas = [];

    const parsed = parseAnalysisDecision(drifted, 25_020);
    expect(parsed.findings[0].evidence[0]).toMatchObject({
      confidence: 0.4,
      phase: null,
      visibleBodyAreas: ["visible movement"],
    });
  });

  it("requires four observed problems regardless of strength or advice counts", () => {
    const source = decision();
    const [correction, strength] = source.findings;
    const advice = {
      ...correction,
      id: "setup-advice",
      title: "Setup safety reminder",
      detail: "This is general setup advice for the next set, not an observed mistake.",
      whyItMatters: "A clear setup makes the starting position easier to repeat.",
      correction: "Check the bench and nearby floor before starting.",
      cue: "Bench set, floor clear.",
      severity: "note",
      observedIssueRegions: [],
    };
    const { findings: _findings, ...base } = source;
    expect(() => parseAnalysisDecision({ ...base, corrections: [correction], strengths: [strength], cues: [] }, 25_020)).toThrow(/at least four/i);
    expect(() => parseAnalysisDecision({
      ...base,
      corrections: [correction, { ...correction, id: "second-correction" }],
      strengths: [strength],
      cues: [],
    }, 25_020)).toThrow(/at least four/i);
    expect(() => parseAnalysisDecision({
      ...base,
      corrections: [
        correction,
        { ...correction, id: "second-correction" },
        { ...correction, id: "third-correction" },
      ],
      strengths: [
        strength,
        { ...strength, id: "second-strength" },
        { ...strength, id: "third-strength" },
      ],
      cues: [advice],
    }, 25_020)).toThrow(/at least four/i);
    expect(parseAnalysisDecision({
      ...base,
      corrections: [
        correction,
        { ...correction, id: "second-correction" },
        { ...correction, id: "third-correction" },
        { ...correction, id: "fourth-correction" },
      ],
      strengths: [
        strength,
        { ...strength, id: "second-strength" },
      ],
      cues: [advice],
    }, 25_020).findings.map((finding) => finding.kind)).toEqual([
      "correction",
      "correction",
      "correction",
      "correction",
      "strength",
      "strength",
      "cue",
    ]);
  });

  it("reserves unable retry guidance for recordings with no analyzable exercise movement", () => {
    const source = decision();
    const { findings: _findings, ...base } = source;
    const unable = {
      ...base,
      status: "unable",
      videoCheck: {
        outcome: "unable",
        usableObservations: [],
        limitations: ["No meaningful repeated exercise movement is visible."],
        retryReason: "The recording does not contain an analyzable exercise set.",
        retryInstruction: "Record the complete exercise set with the person and equipment visible.",
      },
      wholeSetCoverage: null,
      movementAnalysis: null,
      overallAssessment: null,
      score: null,
      scoreRationale: [],
      movementScores: [],
      corrections: null,
      strengths: null,
      cues: [],
      equipmentObservations: [],
      nextSetPlan: [],
    };
    expect(parseAnalysisDecision(unable, 25_020).status).toBe("unable");
  });

  it("accepts every distinct supported correction beyond the four-problem floor", () => {
    const source = decision();
    const [correction, strength] = source.findings;
    const { findings: _findings, ...base } = source;
    const corrections = Array.from({ length: 24 }, (_, index) => ({ ...correction, id: index === 0 ? correction.id : `correction-${index + 1}` }));
    expect(parseAnalysisDecision({ ...base, corrections, strengths: [strength], cues: [] }, 25_020).findings.filter((finding) => finding.kind === "correction")).toHaveLength(24);
  });

  it("preserves every correction from historical split inventories without a category quota", () => {
    const source = decision();
    const [correction, strength] = source.findings;
    const { findings: _findings, ...base } = source;
    const formCorrections = Array.from({ length: 4 }, (_, index) => ({
      ...correction,
      id: `form-${index + 1}`,
      title: `Form issue ${index + 1}`,
    }));
    const additionalCorrections = Array.from({ length: 6 }, (_, index) => ({
      ...correction,
      id: `supplemental-${index + 1}`,
      title: `Supplemental issue ${index + 1}`,
      coachingArea: index % 2 === 0 ? "posture_setup" : "safety_surroundings",
    }));

    const parsed = parseAnalysisDecision({
      ...base,
      formCorrections,
      additionalCorrections,
      strengths: [strength],
      cues: [],
    }, 25_020);

    expect(parsed.findings.filter((finding) => finding.kind === "correction")).toHaveLength(10);
  });

  it("requires all five scoring dimensions exactly once but lets minor corrections remain outside rationale links", () => {
    const missingDimensions = decision();
    missingDimensions.scoreRationale = missingDimensions.scoreRationale.slice(0, 4);
    expect(parseAnalysisDecision(missingDimensions, 25_020).scoreRationale).toHaveLength(5);

    const unscoredMinorCorrection = decision();
    unscoredMinorCorrection.findings.push({
      ...unscoredMinorCorrection.findings[0],
      id: "minor-shoulder-rise",
      title: "Small shoulder rise",
      severity: "note",
      evidence: [{ ...unscoredMinorCorrection.findings[0].evidence[0], startMs: 11_500, peakMs: 13_000, endMs: 14_750, repNumber: 3, confidence: 0.4 }],
    });
    expect(parseAnalysisDecision(unscoredMinorCorrection, 25_020).findings).toHaveLength(3);

    const duplicateDimension = decision();
    duplicateDimension.scoreRationale = duplicateDimension.scoreRationale.map((item) => ({ ...item }));
    duplicateDimension.scoreRationale[4].criterion = "control_tempo";
    expect(parseAnalysisDecision(duplicateDimension, 25_020).scoreRationale.find((item) => item.criterion === "rep_consistency")?.assessment).toBe("limited");
  });

  it("requires every issue-labelled scoring dimension to reference a correction", () => {
    const issueWithoutCorrection = decision();
    issueWithoutCorrection.scoreRationale[1] = {
      criterion: "path_alignment",
      assessment: "issue",
      observed: "The working shoulder rises at the top.",
      impact: 10,
      confidence: 0.85,
      evidenceIds: [],
    };
    expect(parseAnalysisDecision(issueWithoutCorrection, 25_020).scoreRationale[1].assessment).toBe("limited");
  });

  it("keeps the analyst score while applying only proportional lower bounds", () => {
    const inflated = decision();
    inflated.score = 95;
    inflated.findings[0].severity = "important";
    expect(parseAnalysisDecision(inflated, 25_020).score).toBe(95);

    const goodBandWithMajorProblem = decision();
    goodBandWithMajorProblem.score = 85;
    goodBandWithMajorProblem.findings[0].severity = "high";
    expect(parseAnalysisDecision(goodBandWithMajorProblem, 25_020).score).toBe(85);

    const recurringMajorProblem = decision();
    recurringMajorProblem.score = 92;
    recurringMajorProblem.findings[0].severity = "high";
    recurringMajorProblem.findings[0].evidence.push({
      ...recurringMajorProblem.findings[0].evidence[0],
      startMs: 11_500,
      peakMs: 13_000,
      endMs: 14_750,
      repNumber: 3,
    });
    expect(parseAnalysisDecision(recurringMajorProblem, 25_020).score).toBe(92);

    const understatedSeverity = decision();
    understatedSeverity.score = 68;
    understatedSeverity.findings[0].severity = "note";
    expect(parseAnalysisDecision(understatedSeverity, 25_020).score).toBe(86);
  });

  it("does not promote a recurrence claim supported by only one evidence moment", () => {
    const repeated = decision();
    repeated.score = 93;
    repeated.findings[0].severity = "note";
    repeated.findings[0].detail = "The lowering phase speeds up on reps 3 through 6 compared with rep 1.";
    repeated.findings[0].evidence = [repeated.findings[0].evidence[0]];

    const parsed = parseAnalysisDecision(repeated, 25_020);

    expect(parsed.findings[0].severity).toBe("note");
    expect(parsed.findings[0].detail).toBe(parsed.findings[0].evidence[0].visualEvidence);
    expect(parsed.score).toBe(93);
  });

  it("accepts the confidence floor and clamps minor confidence drift", () => {
    const lowConfidence = decision();
    lowConfidence.findings[0].evidence[0].confidence = 0.4;
    expect(parseAnalysisDecision(lowConfidence, 25_020).findings[0].evidence[0].confidence).toBe(0.4);

    lowConfidence.findings[0].evidence[0].confidence = 0.39;
    expect(parseAnalysisDecision(lowConfidence, 25_020).findings.map((finding) => finding.id)).toEqual(["tempo-loss", "stable-base"]);
    expect(parseAnalysisDecision(lowConfidence, 25_020).findings[0].evidence[0].confidence).toBe(0.4);
  });

  it("does not require scoring dimensions when the recording is genuinely unable", () => {
    const unable = decision();
    unable.status = "unable";
    unable.recognition = { label: null, variation: null, equipment: [], confidence: 0, alternatives: [], exerciseFamily: "other" };
    unable.videoCheck = { outcome: "unable", usableObservations: [], limitations: ["No exercise movement is visible."], retryReason: "No exercise movement is visible.", retryInstruction: "Keep the full set visible." };
    (unable as { wholeSetCoverage: unknown }).wholeSetCoverage = null;
    (unable as { movementAnalysis: unknown }).movementAnalysis = null;
    unable.overallAssessment = null;
    unable.score = null;
    unable.scoreRationale = [];
    unable.movementScores = [];
    unable.findings = [];
    unable.setSummary = { totalReps: null, consistentReps: null, verdict: null };
    unable.repTimeline = [];
    unable.nextSetPlan = [];

    expect(parseAnalysisDecision(unable, 25_020)).toMatchObject({ status: "unable", score: null, scoreRationale: [], findings: [] });
  });

  it("accepts the explanatory assessment returned for the rejected empty recording", () => {
    const unable = decision();
    unable.status = "unable";
    unable.recognition = { label: null, variation: null, equipment: [], confidence: 0, alternatives: [], exerciseFamily: "other" };
    unable.videoCheck = {
      outcome: "unable",
      usableObservations: [],
      limitations: ["The recording does not show a person or an exercise movement."],
      retryReason: "No person or exercise movement is visible in the recording.",
      retryInstruction: "Record again with your full body and the complete exercise set visible in frame.",
    };
    (unable as { wholeSetCoverage: unknown }).wholeSetCoverage = null;
    (unable as { movementAnalysis: unknown }).movementAnalysis = null;
    unable.overallAssessment = "This recording cannot be analyzed because no person or exercise movement is visible.";
    unable.score = null;
    unable.scoreRationale = [];
    unable.movementScores = [];
    unable.findings = [];
    unable.setSummary = { totalReps: null, consistentReps: null, verdict: null };
    unable.repTimeline = [];
    unable.nextSetPlan = [];

    expect(parseAnalysisDecision(unable, 3_826)).toMatchObject({
      status: "unable",
      overallAssessment: "This recording cannot be analyzed because no person or exercise movement is visible.",
      score: null,
      findings: [],
      videoCheck: {
        retryReason: "No person or exercise movement is visible in the recording.",
        retryInstruction: "Record again with your full body and the complete exercise set visible in frame.",
      },
    });
  });

  it("normalizes a chosen peak to its interval and discards evidence far outside the recording", () => {
    const outsideInterval = decision();
    outsideInterval.findings[0].evidence[0].peakMs = 18_000;
    expect(parseAnalysisDecision(outsideInterval, 25_020).findings[0].evidence[0].peakMs).toBe(16_999);

    const outsideVideo = decision();
    outsideVideo.findings[0].evidence[0] = { ...outsideVideo.findings[0].evidence[0], startMs: 27_000, peakMs: 28_000, endMs: 30_000 };
    expect(parseAnalysisDecision(outsideVideo, 25_020).findings.map((finding) => finding.id)).toEqual(["stable-base"]);
  });

  it("rejects a small model timestamp overshoot outside the active set", () => {
    const nearBoundary = decision();
    nearBoundary.findings[0].evidence[0] = {
      ...nearBoundary.findings[0].evidence[0],
      startMs: 26_000,
      peakMs: 27_000,
      endMs: 28_000,
    };

    expect(() => parseAnalysisDecision(nearBoundary, 25_020)).toThrow(/outside the active-set interval/i);
  });

  it("drops invalid optional focus coordinates without rejecting the correction", () => {
    const pixelFocus = decision();
    pixelFocus.findings[0].evidence[0].focusRegion = {
      centerX: 530,
      centerY: 420,
      radius: 100,
      arrowFromX: 450,
      arrowFromY: 250,
      label: "working arm",
      confidence: 0.9,
    };

    const parsed = parseAnalysisDecision(pixelFocus, 25_020);
    expect(parsed.findings[0].evidence[0].focusRegion).toBeNull();
    expect(parsed.findings[0].title).toBe("Control the lowering phase");
  });

  it("drops an optional cue with grossly invalid evidence without losing valid corrections", () => {
    const optionalBadCue = decision();
    optionalBadCue.findings.push({
      ...optionalBadCue.findings[1],
      id: "cue-after-recording",
      kind: "cue",
      evidence: [{
        ...optionalBadCue.findings[1].evidence[0],
        startMs: 30_000,
        peakMs: 31_000,
        endMs: 32_000,
      }],
    });
    optionalBadCue.scoreRationale[0] = {
      ...optionalBadCue.scoreRationale[0],
      evidenceIds: ["stable-base", "cue-after-recording"],
    };

    const parsed = parseAnalysisDecision(optionalBadCue, 25_020);
    expect(parsed.findings.map((finding) => finding.id)).toEqual(["tempo-loss", "stable-base"]);
    expect(parsed.scoreRationale[0].evidenceIds).toEqual(["stable-base"]);
    expect(parsed.score).toBe(82);
  });

  it("drops a grossly invalid extra evidence occurrence while keeping the correction", () => {
    const extraBadOccurrence = decision();
    extraBadOccurrence.findings[0].detail = "The dumbbell returns faster throughout the movement.";
    extraBadOccurrence.findings[0].evidence.push({
      ...extraBadOccurrence.findings[0].evidence[0],
      startMs: 30_000,
      peakMs: 31_000,
      endMs: 32_000,
    });

    const parsed = parseAnalysisDecision(extraBadOccurrence, 25_020);
    expect(parsed.findings[0].evidence).toHaveLength(1);
    expect(parsed.findings[0].evidence[0].peakMs).toBe(16_500);
    expect(parsed.findings[0].detail).toBe(parsed.findings[0].evidence[0].visualEvidence);

    const noValidOccurrence = decision();
    noValidOccurrence.findings[0].evidence = [extraBadOccurrence.findings[0].evidence[1]];
    expect(parseAnalysisDecision(noValidOccurrence, 25_020).findings.map((finding) => finding.id)).toEqual(["stable-base"]);
  });

  it("keeps the representative marker and normalizes broad evidence windows to four seconds", () => {
    const boundary = decision();
    boundary.findings[0].evidence[0].peakMs = boundary.findings[0].evidence[0].startMs;
    expect(parseAnalysisDecision(boundary, 25_020).findings[0].evidence[0].peakMs).toBe(boundary.findings[0].evidence[0].startMs + 1);

    const temporal = decision();
    temporal.findings[0].evidence[0] = { ...temporal.findings[0].evidence[0], startMs: 13_500, peakMs: 16_000, endMs: 17_500 };
    expect(parseAnalysisDecision(temporal, 25_020).findings[0].evidence[0]).toMatchObject({ startMs: 13_500, peakMs: 16_000, endMs: 17_500 });

    const tooBroad = decision();
    tooBroad.findings[0].evidence[0] = { ...tooBroad.findings[0].evidence[0], startMs: 13_000, peakMs: 15_500, endMs: 17_500 };
    expect(parseAnalysisDecision(tooBroad, 25_020).findings[0].evidence[0]).toMatchObject({ startMs: 13_500, peakMs: 15_500, endMs: 17_500 });
  });

  it("normalizes an invalid evidence phase without requiring an exact repetition peak", () => {
    const unknownPhase = decision();
    unknownPhase.findings[0].evidence[0].phase = "pulled to chest";
    expect(parseAnalysisDecision(unknownPhase, 25_020).findings.map((finding) => finding.id)).toEqual(["tempo-loss", "stable-base"]);
    expect(parseAnalysisDecision(unknownPhase, 25_020).findings[0].evidence[0].phase).toBeNull();

    const topAwayFromRepPeak = decision();
    topAwayFromRepPeak.findings[0].evidence[0].phase = "top";
    topAwayFromRepPeak.findings[0].evidence[0].peakMs = 16_000;
    expect(parseAnalysisDecision(topAwayFromRepPeak, 25_020).findings[0].evidence[0].peakMs).toBe(16_000);
  });

  it("accepts transition evidence between adjacent repetitions", () => {
    const transition = decision();
    transition.findings[0].evidence[0] = {
      ...transition.findings[0].evidence[0],
      startMs: 7_500,
      peakMs: 7_625,
      endMs: 7_750,
      repNumber: 1,
      phase: "transition",
      visualEvidence: "The pause between repetitions interrupts the set cadence.",
    };
    expect(parseAnalysisDecision(transition, 25_020).findings[0].evidence[0].phase).toBe("transition");
  });

  it("keeps approximate rep references and clears mismatched rep bookkeeping", () => {
    const approximate = decision();
    approximate.findings[1].evidence[0] = {
      ...approximate.findings[1].evidence[0],
      startMs: 7_000,
      peakMs: 7_750,
      endMs: 8_000,
      repNumber: 1,
    };
    expect(parseAnalysisDecision(approximate, 25_020).findings[1].evidence[0].peakMs).toBe(7_750);

    approximate.findings[1].evidence[0] = { ...approximate.findings[1].evidence[0], startMs: 7_500, peakMs: 8_501, endMs: 9_000 };
    expect(parseAnalysisDecision(approximate, 25_020).findings[1].evidence[0].repNumber).toBeNull();

    approximate.findings[1].evidence[0] = { ...approximate.findings[1].evidence[0], repNumber: 99 };
    expect(parseAnalysisDecision(approximate, 25_020).findings[1].evidence[0].repNumber).toBeNull();
  });

  it("clears uncertain set counts instead of rejecting correction coaching", () => {
    const mismatchedCounts = decision();
    mismatchedCounts.setSummary = { ...mismatchedCounts.setSummary, totalReps: 6, consistentReps: 5 };
    expect(parseAnalysisDecision(mismatchedCounts, 25_020).setSummary).toMatchObject({ totalReps: null, consistentReps: null });
  });

  it("allows writer copy to change wording but not analyst-owned fields", () => {
    const source = parseAnalysisDecision(decision(), 25_020);
    const patch = parseWriterCopyPatch(writerPatch({
      findings: [{
        findingId: "tempo-loss",
        title: "Own the lowering phase",
        whatHappened: "The first returns are controlled, but the dumbbell finishes the later returns faster.",
        whyItMatters: "A consistent lowering pace keeps the row repeatable. Matching the early pace also keeps the bottom position predictable.",
        whatToDo: "Own the way down and make the final return match the first.",
      }],
    }), source);
    const merged = mergeWriterCopy(source, patch);

    expect(merged.score).toBe(82);
    expect(merged.priorityCorrections[0].severity).toBe("important");
    expect(merged.priorityCorrections[0].evidence.map((item) => item.peakMs)).toEqual(source.findings[0].evidence.map((item) => item.peakMs));
    expect(merged.priorityCorrections[0].evidence.map((item) => item.repNumber)).toEqual([4]);
    expect(merged.repTimeline).toEqual(source.repTimeline);
    expect(merged.priorityCorrections[0].title).toBe("Own the lowering phase");
    expect(merged.priorityCorrections[0].expandedCoaching?.whatHappened).toContain("later returns");
    expect(merged.muscleFocus).toEqual({
      primary: [
        { name: "Latissimus dorsi", region: "lats" },
        { name: "Upper back", region: "upper_back" },
      ],
      secondary: [{ name: "Biceps", region: "biceps" }],
      unclassified: [],
    });
    expect(merged.coachNote).toContain("support position");
    expect(merged).not.toHaveProperty("wholeSetCoverage");
  });

  it("rejects unsupported internal-mechanics coaching instead of rewriting it", () => {
    const raw = decision();
    raw.findings[0].detail = "The dumbbell travels straight upward toward the chest instead of sweeping back toward the hip.";
    raw.findings[0].whyItMatters = "Pulling straight up reduces back leverage and increases trap involvement.";
    const source = parseAnalysisDecision(raw, 25_020);
    expect(() => parseWriterCopyPatch(writerPatch({
      findings: [{
        findingId: "tempo-loss",
        title: "Pull path trajectory",
        whatHappened: "The dumbbell travels straight upward toward the chest instead of sweeping back toward the hip.",
        whyItMatters: "Shoulder elevation reduces leverage and changes the bar path.",
        whatToDo: "Sweep the dumbbell toward the hip.",
      }],
    }), source)).toThrow(/unsupported/i);
    expect(() => parseWriterCopyPatch(writerPatch({
      overallAssessment: "The set shows steady bracing and a close dumbbell path. Match the final lowering phase to the first.",
    }), source)).toThrow(/unsupported/i);
  });

  it("rejects technical biomechanics wording so the writer repairs it into everyday coaching", () => {
    const source = parseAnalysisDecision(decision(), 25_020);

    expect(() => parseWriterCopyPatch(writerPatch({
      findings: [{
        findingId: "tempo-loss",
        title: "Eccentric kinematic trajectory",
        whatHappened: "Thoracic extension increases during the eccentric phase.",
        whyItMatters: "The altered center of mass changes the implement trajectory.",
        whatToDo: "Maintain scapular retraction through the eccentric phase.",
      }],
    }), source)).toThrow(/technical coaching jargon/i);
  });

  it("rejects textbook lifting labels that should be ordinary gym language", () => {
    const source = parseAnalysisDecision(decision(), 25_020);

    expect(() => parseWriterCopyPatch(writerPatch({
      findings: [{
        findingId: "tempo-loss",
        title: "Wrist Position at Peak Extension",
        whatHappened: "Your wrist moves into extension during the lowering phase.",
        whyItMatters: "That makes the bottom reversal less steady.",
        whatToDo: "Reach an even peak height without resting over neutral joints before lockout.",
      }],
    }), source)).toThrow(/technical coaching jargon/i);
  });

  it("allows ordinary anatomy and visible equipment tension without treating the words alone as hidden mechanics", () => {
    const source = parseAnalysisDecision(decision(), 25_020);
    const patch = parseWriterCopyPatch(writerPatch({
      coachNote: "Keep the upper-back and biceps focus while making the cable tension look just as steady at the end.",
    }), source);

    expect(patch.coachNote).toContain("biceps");
    expect(patch.coachNote).toContain("tension");
  });

  it("deduplicates a muscle region when the writer classifies it as both primary and secondary", () => {
    const source = parseAnalysisDecision(decision(), 25_020);
    const patch = parseWriterCopyPatch(writerPatch({
      muscleFocus: {
        primary: [{ name: "Upper back", region: "upper_back" }],
        secondary: [
          { name: "Upper back support", region: "upper_back" },
          { name: "Biceps", region: "biceps" },
        ],
      },
    }), source);

    expect(patch.muscleFocus.secondary).toEqual([{ name: "Biceps", region: "biceps" }]);
  });

  it("can validate its normalized persisted writer copy again during assembly", () => {
    const source = parseAnalysisDecision(decision(), 25_020);
    const persisted = parseWriterCopyPatch(writerPatch(), source);

    expect(parseWriterCopyPatch(persisted, source)).toEqual(persisted);
  });

  it("preserves valid writer copy verbatim while keeping analyst-owned score calibration", () => {
    const raw = decision();
    raw.score = 92;
    raw.findings[0].severity = "high";
    const source = parseAnalysisDecision(raw, 25_020);
    const patch = parseWriterCopyPatch(writerPatch({
      overallAssessment: "The set keeps a steady base and close dumbbell path. The fast late return is the primary weakness, so control the dumbbell to the bottom.",
    }), source);
    const merged = mergeWriterCopy(source, patch);

    expect(merged.score).toBe(92);
    expect(merged.overallAssessment).toBe(patch.overallAssessment);
    expect(merged.setSummary?.verdict).toBe(merged.overallAssessment);
  });

  it("keeps low-confidence findings while preserving legacy public confidence floors", () => {
    const lowConfidence = decision();
    lowConfidence.findings[0].evidence[0].confidence = 0.4;
    lowConfidence.findings[0].evidence[0].focusRegion = { centerX: 0.5, centerY: 0.5, radius: 0.15, arrowFromX: 0.8, arrowFromY: 0.2, label: "working arm", confidence: 0.4 };
    lowConfidence.findings[0].evidence[0] = { ...lowConfidence.findings[0].evidence[0], startMs: 15_000, peakMs: 16_500, endMs: 17_500, repNumber: 4 };
    const source = parseAnalysisDecision(lowConfidence, 25_020);
    const merged = mergeWriterCopy(source, null);

    expect(source.findings[0].evidence[0].confidence).toBe(0.4);
    expect(source.findings[0].evidence[0].repNumber).toBe(4);
    expect(merged.priorityCorrections[0].evidence[0].confidence).toBe(0.75);
    expect(merged.priorityCorrections[0].evidence[0].focusRegion?.confidence).toBe(0.8);
    expect(merged.priorityCorrections[0].evidence[0].repNumber).toBe(4);
    expect(merged.repTimeline).toEqual(source.repTimeline);
  });

  it("rejects writer attempts to add score or unknown finding IDs", () => {
    const source = parseAnalysisDecision(decision(), 25_020);
    expect(() => parseWriterCopyPatch({ ...writerPatch(), score: 99 }, source)).toThrow(/unexpected/i);
    expect(() => parseWriterCopyPatch(writerPatch({
      findings: [{
        findingId: "invented",
        title: "Control",
        whatHappened: "The dumbbell moves faster late.",
        whyItMatters: "The path becomes less repeatable. A steady return keeps the endpoint consistent.",
        whatToDo: "Own the return.",
      }],
    }), source)).toThrow(/unknown correction/i);
  });

  it("does not let writer copy erase actionable coaching from a correction", () => {
    const source = parseAnalysisDecision(decision(), 25_020);
    expect(() => parseWriterCopyPatch(writerPatch({
      findings: [{
        findingId: "tempo-loss",
        title: "Control",
        whatHappened: "The dumbbell moves faster late.",
        whyItMatters: "The path becomes less repeatable. A steady return keeps the endpoint consistent.",
        whatToDo: "",
      }],
    }), source)).toThrow(/non-empty string/i);
  });

  it("restores the analyst observation when writer copy invents unsupported recurrence", () => {
    const source = parseAnalysisDecision(decision(), 25_020);
    source.findings[0].detail = "The lowering phase speeds up on rep 4.";
    source.findings[0].evidence = [source.findings[0].evidence[0]];
    const patch = parseWriterCopyPatch(writerPatch({
      findings: [{
        findingId: "tempo-loss",
        title: "Control the return",
        whatHappened: "The dumbbell drops quickly throughout the set.",
        whyItMatters: "The path becomes less repeatable. The repeated speed change makes every endpoint inconsistent.",
        whatToDo: "Slow down every return.",
      }],
    }), source);

    expect(patch.findings[0].whatHappened).toBe("The lowering phase speeds up on rep 4.");
  });

  it("allows next-set cues to describe a future full-set action without inventing observed recurrence", () => {
    const source = parseAnalysisDecision(decision(), 25_020);
    source.findings[0].detail = "The lowering phase speeds up on rep 4.";
    source.findings[0].evidence = [source.findings[0].evidence[0]];
    const patch = parseWriterCopyPatch(writerPatch({
      findings: [{
        findingId: "tempo-loss",
        title: "Control the return",
        whatHappened: "The dumbbell drops quickly on the cited return.",
        whyItMatters: "A steady lowering pace makes the endpoint more repeatable throughout a set.",
        whatToDo: "Use the same slow return throughout the next set.",
      }],
    }), source);

    expect(patch.findings[0].whatToDo).toContain("throughout the next set");
  });
});
