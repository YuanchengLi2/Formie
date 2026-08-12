import { resultPayload } from "./result-payload";
import { analysisResultSchema } from "../../../src/features/analysis/result-schema";

describe("resultPayload", () => {
  it("returns an isolated v49 public result directly without legacy normalization", () => {
    const v49 = {
      status: "complete",
      analysisBasis: "observed",
      recognition: { label: "Chest-Supported Row", variation: null, equipment: ["dumbbells"], confidence: 1, alternatives: [], catalogExerciseId: 14, exerciseFamily: "row", source: "user_declared" },
      overallAssessment: "The Chest-Supported Row needs a more upward pull.",
      muscleFocus: { primary: [{ name: "Latissimus dorsi", region: "lats" }], secondary: [], unclassified: [] },
      coachNote: "Drive the elbows upward.", score: 65, scoreRationale: [], movementScores: [], scorecard: null, equipmentObservations: [], didWell: [], priorityCorrections: [], coachingCues: [],
      setContext: { cameraView: null, visibleReferences: [], sequenceSummary: null, changeAcrossSet: null, coachingBasis: "Full video" },
      setSummary: { totalReps: 10, consistentReps: null, verdict: "Fix pull direction." }, nextSetPlan: [], precisionRequest: { requestedRuns: 0, reason: null, targets: [] }, comparison: null,
    };
    expect(resultPayload({ pipeline_version: "gemini-problem-finder-v49", active_v49_run_id: "run-1" }, null, v49)).toBe(v49);
  });
  it("maps current whole-video results directly and normalizes the retired mixed label on readable v46 results", () => {
    const result = {
      status: "complete",
      video_check: { outcome: "usable", usableObservations: ["Full set"], limitations: [], retryReason: null, retryInstruction: null },
      overall_assessment: "The complete set was reviewed.",
      muscle_focus: { primary: [{ name: "Quadriceps", region: "quads" }], secondary: [], unclassified: [] },
      coach_note: "Keep the same path.",
      score: 93,
      score_rationale: [],
      movement_scores: [
        { id: "a", label: "Depth", score: 90, observed: "Visible", evidenceIds: [] },
        { id: "b", label: "Knee Path", score: 91, observed: "Visible", evidenceIds: [] },
        { id: "c", label: "Torso", score: 94, observed: "Visible", evidenceIds: [] },
        { id: "d", label: "Tempo", score: 97, observed: "Visible", evidenceIds: [] },
      ],
      equipment_observations: [], did_well: [], priority_corrections: [], coaching_cues: [],
      set_context: { cameraView: null, visibleReferences: [], sequenceSummary: "Four reps", changeAcrossSet: "Stable", coachingBasis: "Visible set" },
      set_summary: { totalReps: 4, consistentReps: 4, verdict: "Consistent" },
      rep_timeline: [], next_set_plan: [], comparison: null,
    };
    const payload = resultPayload({ pipeline_version: "gemini-whole-video-v47", detected_label: "Squat", detected_equipment: [], exercise_family: "squat" }, result);
    expect(payload?.score).toBe(93);
    expect(payload?.movementScores).toHaveLength(4);
    expect(payload?.priorityCorrections).toBe(result.priority_corrections);
    expect(payload).not.toHaveProperty("videoCheck");
    expect(payload).not.toHaveProperty("repTimeline");
    expect(resultPayload(
      { pipeline_version: "gemini-whole-video-v48", detected_label: "Squat", detected_equipment: [], exercise_family: "squat" },
      result,
    )?.score).toBe(93);
    const recheckPayload = resultPayload(
      { pipeline_version: "gemini-whole-video-v48-recheck1", detected_label: "Squat", detected_equipment: [], exercise_family: "squat" },
      result,
    );
    expect(recheckPayload?.movementScores).toHaveLength(4);
    expect(recheckPayload?.priorityCorrections).toBe(result.priority_corrections);
    expect(recheckPayload).not.toHaveProperty("repTimeline");
    const tabSpecificPayload = resultPayload(
      { pipeline_version: "gemini-whole-video-v48-recheck2", detected_label: "Squat", detected_equipment: [], exercise_family: "squat" },
      result,
    );
    expect(tabSpecificPayload?.priorityCorrections).toBe(result.priority_corrections);
    expect(tabSpecificPayload).not.toHaveProperty("repTimeline");
    const accuracyRestoredPayload = resultPayload(
      { pipeline_version: "gemini-whole-video-v52", detected_label: "Squat", detected_equipment: [], exercise_family: "squat" },
      result,
    );
    expect(accuracyRestoredPayload?.priorityCorrections).toBe(result.priority_corrections);
    expect(accuracyRestoredPayload).not.toHaveProperty("repTimeline");
    for (const pipeline_version of [
      "gemini-whole-video-v57-nonblocking-writer",
      "gemini-whole-video-v63-three-sentence-what-happened",
      "gemini-whole-video-v64-durable-single-pass-retry",
      "gemini-whole-video-v65-original-coaching",
      "gemini-whole-video-v66-original-coaching-provider-compatible",
    ]) {
      const current = resultPayload({ pipeline_version, detected_label: "Squat", detected_equipment: [], exercise_family: "squat" }, result);
      expect(current?.priorityCorrections).toBe(result.priority_corrections);
      expect(current).not.toHaveProperty("repTimeline");
    }
    expect(resultPayload(
      { pipeline_version: "gemini-whole-video-v46", detected_label: "Squat", detected_equipment: [], exercise_family: "squat" },
      { ...result, analysis_basis: "mixed" },
    )?.analysisBasis).toBe("observed");
  });

  it("maps persisted Gemini recognition and coaching into the app contract", () => {
    expect(resultPayload(
      { detected_label: "Curl", detected_variation: null, detected_equipment: ["dumbbells"], recognition_confidence: 0.9, recognition_alternatives: [], exercise_id: 35, corrected_label: null, corrected_exercise_id: null, camera_view: "side" },
      { status: "complete", video_check: { outcome: "usable", usableObservations: [], limitations: [], retryReason: null, retryInstruction: null }, overall_assessment: "Controlled", score: null, score_rationale: [], equipment_observations: [{ id: "load", category: "visible_load", title: "Load unreadable", observation: "The load is not readable.", coachingRelevance: null, load: { value: null, unit: null, scope: null, certainty: "unknown", basis: "not_readable" }, evidence: [] }], did_well: [], priority_corrections: [], coaching_cues: [], set_context: { cameraView: "front", visibleReferences: ["shoulders", "handle endpoint"], sequenceSummary: "Eight reps were visible.", changeAcrossSet: "The path stayed consistent.", coachingBasis: "Preserve the same endpoint." }, set_summary: { totalReps: 8, consistentReps: 7, verdict: "Seven stayed controlled." }, rep_timeline: [{ repNumber: 1, startMs: 100, peakMs: 500, endMs: 900, assessment: "strong", note: "Controlled" }], next_set_plan: [{ id: "plan-1", action: "Repeat the tempo", rationale: "Keep control", relatedFindingId: null }], premium_runs_used: 2, precision_review: { runsRequested: 2, runsUsed: 2, status: "completed", summary: "Reviewed", passes: [] }, verification: { performed: true, reason: "subtle", outcome: "confirmed", checkedFindingId: "finding-1" }, comparison: null },
    )).toMatchObject({
      recognition: { label: "Curl" },
      overallAssessment: "Controlled",
      muscleFocus: { primary: [], secondary: [], unclassified: [] },
      coachNote: null,
      score: 75,
      setContext: { cameraView: "front", visibleReferences: ["shoulders", "handle endpoint"], sequenceSummary: "Eight reps were visible." },
      setSummary: { totalReps: 8, consistentReps: 7 },
      repTimeline: [{ repNumber: 1 }],
      nextSetPlan: [],
      equipmentObservations: [{ id: "load" }],
    });
  });

  it("supplies safe precision-coaching defaults for older persisted results", () => {
    const payload = resultPayload(
      { detected_label: "Squat", detected_equipment: [], recognition_confidence: 0.8, recognition_alternatives: [], exercise_family: "squat" },
      { status: "partial", video_check: { outcome: "partial", usableObservations: [], limitations: [], retryReason: null, retryInstruction: null }, overall_assessment: "Partially visible", score: null, score_rationale: [], did_well: [], priority_corrections: [], coaching_cues: [], comparison: null },
    );
    expect(payload).toMatchObject({
      setSummary: { totalReps: null, consistentReps: null, verdict: null },
      setContext: { cameraView: null, visibleReferences: [], sequenceSummary: null, changeAcrossSet: null, coachingBasis: null },
      repTimeline: [],
      score: 75,
      nextSetPlan: [],
    });
    expect(analysisResultSchema.safeParse(payload).success).toBe(true);
  });

  it("returns personalized summary fields persisted by the new writer", () => {
    const payload = resultPayload(
      { detected_label: "Dumbbell Bench Press", detected_equipment: ["dumbbells"], recognition_confidence: 1, recognition_alternatives: [], exercise_family: "press" },
      {
        status: "complete",
        video_check: { outcome: "usable", usableObservations: [], limitations: [], retryReason: null, retryInstruction: null },
        overall_assessment: "The path stayed controlled early. Your setup remained stable across the set. Keep the final presses aligned with the first.",
        muscle_focus: {
          primary: [{ name: "Chest", region: "chest" }],
          secondary: [
            { name: "Triceps", region: "triceps" },
            { name: "Front shoulders", region: "front_shoulders" },
          ],
          unclassified: [],
        },
        coach_note: "Your base gave you a repeatable start; now carry that same control through the final press.",
        score: 82,
        score_rationale: [],
        did_well: [],
        priority_corrections: [],
        coaching_cues: [],
        comparison: null,
      },
    );

    expect(payload).toMatchObject({
      muscleFocus: {
        primary: [{ name: "Chest", region: "chest" }],
        secondary: [
          { name: "Triceps", region: "triceps" },
          { name: "Front shoulders", region: "front_shoulders" },
        ],
        unclassified: [],
      },
      coachNote: "Your base gave you a repeatable start; now carry that same control through the final press.",
    });
    expect(analysisResultSchema.safeParse(payload).success).toBe(true);
  });

  it("hydrates movement-specific scores and anatomy issue regions from persisted results", () => {
    const correction = {
      id: "path",
      title: "Guide the dumbbell toward the hip",
      detail: "The dumbbell finishes beside the ribs instead of near the hip.",
      whyItMatters: "A repeatable endpoint keeps the pulling path consistent.",
      correction: "Guide the dumbbell back toward the hip.",
      cue: "Pocket, not ribs.",
      actionableCorrection: { instruction: "Guide the dumbbell back toward the hip.", cue: "Pocket, not ribs.", successCheck: "The dumbbell finishes near the hip.", applyWhen: "At the top of the pull." },
      severity: "important",
      observedIssueRegions: ["elbows", "lats"],
      evidence: [{ startMs: 1_000, peakMs: 1_300, endMs: 1_600, repNumber: 2, phase: "top", visualEvidence: "The dumbbell finishes beside the ribs.", visibleBodyAreas: ["dumbbell", "elbow", "hip"], confidence: 0.9 }],
    };
    const payload = resultPayload(
      { detected_label: "One-arm Dumbbell Row", detected_equipment: ["dumbbell"], recognition_confidence: 1, recognition_alternatives: [], exercise_family: "row" },
      {
        status: "complete",
        pipeline_version: "gemini-analyst-coach-v22",
        video_check: { outcome: "usable", usableObservations: [], limitations: [], retryReason: null, retryInstruction: null },
        overall_assessment: "The base stays planted, but the dumbbell endpoint needs a more repeatable path.",
        score: 78,
        score_rationale: [],
        movement_scores: [
          { id: "dumbbell-path", label: "Dumbbell Path", score: 64, observed: "The dumbbell finishes beside the ribs.", evidenceIds: ["path"] },
          { id: "torso-control", label: "Torso Control", score: 85, observed: "The torso remains stable.", evidenceIds: [] },
          { id: "top-range", label: "Top Range", score: 72, observed: "The endpoint changes across the set.", evidenceIds: ["path"] },
        ],
        did_well: [],
        priority_corrections: [correction],
        coaching_cues: [],
        next_set_plan: [],
        comparison: null,
      },
    );

    expect(payload?.movementScores).toEqual([]);
    expect(payload?.priorityCorrections[0].observedIssueRegions).toEqual(["elbows", "lats"]);
    expect(analysisResultSchema.safeParse(payload).success).toBe(true);
  });

  it("normalizes historically invalid bodyweight load metadata before returning it to the app", () => {
    const payload = resultPayload(
      {
        detected_label: "Bodyweight Squat",
        detected_equipment: [],
        recognition_confidence: 1,
        recognition_alternatives: [],
        exercise_family: "squat",
      },
      {
        status: "complete",
        pipeline_version: "gemini-analyst-coach-v27",
        video_check: { outcome: "usable", usableObservations: ["full body"], limitations: [], retryReason: null, retryInstruction: null },
        overall_assessment: "The complete set is visible.",
        score: 80,
        score_rationale: [],
        movement_scores: [],
        equipment_observations: [{
          id: "eq_bodyweight_setup",
          category: "setup",
          title: "Bodyweight setup",
          observation: "The athlete performs the set without external resistance.",
          coachingRelevance: "The setup is visible.",
          load: { value: null, unit: null, scope: "bodyweight", certainty: "exact_visible", basis: "not_readable" },
          evidence: [{
            startMs: 0,
            peakMs: 833,
            endMs: 2_500,
            visualEvidence: "No external resistance is visible.",
            visibleReferences: ["hands", "torso"],
            confidence: 0.92,
            focusRegion: null,
          }],
        }],
        did_well: [],
        priority_corrections: [],
        coaching_cues: [],
        next_set_plan: [],
        comparison: null,
      },
    );

    expect(payload?.equipmentObservations[0].load).toBeNull();
    expect(analysisResultSchema.safeParse(payload).success).toBe(true);
  });

  it("keeps legacy muscle lists readable without inventing classifications", () => {
    const payload = resultPayload(
      { detected_label: "Curl", detected_equipment: [], recognition_confidence: 1, recognition_alternatives: [], exercise_family: "curl" },
      {
        status: "complete",
        video_check: { outcome: "usable", usableObservations: [], limitations: [], retryReason: null, retryInstruction: null },
        overall_assessment: "The set stayed controlled. The base was stable. Keep the final path matched to the first.",
        muscle_focus: ["Biceps", "Forearms"],
        score: 80,
        score_rationale: [],
        did_well: [],
        priority_corrections: [],
        coaching_cues: [],
        comparison: null,
      },
    );

    expect(payload?.muscleFocus).toEqual({
      primary: [],
      secondary: [],
      unclassified: ["Biceps", "Forearms"],
    });
  });

  it("preserves new-pipeline coaching prose without legacy sentence rewriting", () => {
    const whatHappened = "The handle starts close to the torso. It moves farther out in the middle. The shoulder rises with it. The path changes again near the end. The final endpoint finishes highest.";
    const correction = {
      id: "path",
      title: "Match the handle path",
      detail: whatHappened,
      whyItMatters: "A consistent handle path makes the endpoint repeatable.",
      correction: "Guide the handle along the same path from beginning to end.",
      cue: "Match the first path.",
      actionableCorrection: { instruction: "Guide the handle along the same path from beginning to end.", cue: "Match the first path.", successCheck: null, applyWhen: "During the pull." },
      expandedCoaching: { summary: "Match the handle path", whatHappened, whyItMatters: "A consistent handle path makes the endpoint repeatable.", whatToDo: "Match the first path.", successCheck: null },
      severity: "important",
      evidence: [{ startMs: 1_000, peakMs: 1_300, endMs: 1_600, repNumber: null, phase: "concentric", visualEvidence: "The handle moves farther from the torso.", visibleBodyAreas: ["handle", "torso"], confidence: 0.9 }],
    };
    const payload = resultPayload(
      { detected_label: "Cable Row", detected_equipment: ["cable"], recognition_confidence: 1, recognition_alternatives: [], exercise_family: "row" },
      { status: "complete", pipeline_version: "gemini-analyst-coach-v33", video_check: { outcome: "usable", usableObservations: [], limitations: [], retryReason: null, retryInstruction: null }, overall_assessment: "The path is steady early. The base remains planted. Match the late handle path to the beginning.", score: 80, score_rationale: [], did_well: [], priority_corrections: [correction], coaching_cues: [], next_set_plan: [], comparison: null },
    );

    expect(payload?.priorityCorrections[0].expandedCoaching?.whatHappened).toBe(whatHappened);
    expect(payload?.priorityCorrections[0].detail).toBe(whatHappened);
  });

  it("reuses legacy coaching as an actionable next-set plan so old analyses still open", () => {
    const correction = {
      id: "legacy-drift",
      title: "Elbow drift",
      detail: "The elbows moved forward late in the set.",
      whyItMatters: "The curl becomes less repeatable.",
      correction: "Keep your upper arms beside your torso.",
      cue: "Only the forearms move.",
      severity: "important",
      evidence: [{ startMs: 1_000, peakMs: 1_300, endMs: 1_600, repNumber: null, phase: "lifting", visualEvidence: "Elbows move forward.", visibleBodyAreas: ["elbows"], confidence: 0.9 }],
    };
    expect(resultPayload(
      { detected_label: "Curl", detected_equipment: [], recognition_confidence: 0.8, recognition_alternatives: [], exercise_family: "curl" },
      { status: "complete", video_check: { outcome: "usable", usableObservations: [], limitations: [], retryReason: null, retryInstruction: null }, overall_assessment: "Useful set", score: null, score_rationale: [], did_well: [], priority_corrections: [correction], coaching_cues: [], next_set_plan: [], comparison: null },
    )).toMatchObject({
      nextSetPlan: [{ id: "legacy-next-set", action: correction.correction, rationale: correction.whyItMatters, relatedFindingId: correction.id }],
      priorityCorrections: [{ actionableCorrection: { instruction: correction.correction, cue: correction.cue }, evidence: [{ focusRegion: null, coachingNote: "Elbows move forward." }] }],
      score: 75,
    });
  });

  it("drops legacy next-set advice linked to a strength so completed results remain readable", () => {
    const strength = {
      id: "legacy-strength",
      title: "Stable lockout",
      detail: "The resting arm remains steady overhead.",
      whyItMatters: "That keeps the position repeatable.",
      correction: null,
      cue: null,
      severity: "note",
      evidence: [{ startMs: 1_000, peakMs: 1_300, endMs: 1_600, repNumber: 1, phase: "top", visualEvidence: "The resting arm remains overhead.", visibleBodyAreas: ["arm"], confidence: 0.9 }],
    };
    const payload = resultPayload(
      { detected_label: "Dumbbell Press", detected_equipment: ["dumbbells"], recognition_confidence: 0.9, recognition_alternatives: [], exercise_family: "press" },
      { status: "complete", video_check: { outcome: "usable", usableObservations: [], limitations: [], retryReason: null, retryInstruction: null }, overall_assessment: "Strong set", score: 93, score_rationale: [], did_well: [strength], priority_corrections: [], coaching_cues: [], next_set_plan: [{ id: "legacy-plan", action: "Maintain the lockout.", rationale: "Keep the set stable.", successCheck: "The arm stays steady.", relatedFindingId: strength.id }], comparison: null },
    );

    expect(payload?.nextSetPlan).toEqual([]);
    expect(analysisResultSchema.safeParse(payload).success).toBe(true);
  });

  it("preserves legacy anatomical and coaching language without rewriting it", () => {
    const correction = {
      id: "legacy-elbows",
      title: "Keep elbows steady",
      detail: "During the lowering phase, your elbows drift outward. This happens throughout the set.",
      whyItMatters: "This reduces triceps isolation and creates extra joint strain.",
      correction: "Your elbows should stay in place.",
      cue: "Elbows steady.",
      severity: "important",
      evidence: [{ startMs: 2_000, peakMs: 2_400, endMs: 2_800, repNumber: 1, phase: "eccentric", visualEvidence: "The elbows move outward as the weight lowers.", visibleBodyAreas: ["elbows"], confidence: 0.9 }],
    };
    const payload = resultPayload(
      { detected_label: "Skull Crushers", detected_equipment: ["dumbbells"], recognition_confidence: 0.9, recognition_alternatives: [], exercise_family: "triceps" },
      { status: "complete", video_check: { outcome: "usable", usableObservations: [], limitations: [], retryReason: null, retryInstruction: null }, overall_assessment: "Useful set", score: 80, score_rationale: [], did_well: [], priority_corrections: [correction], coaching_cues: [], next_set_plan: [], comparison: null },
    );
    const normalized = payload?.priorityCorrections[0];
    const sentences = [
      normalized?.detail,
      normalized?.whyItMatters,
      normalized?.actionableCorrection?.instruction,
      normalized?.actionableCorrection?.successCheck,
    ].filter((value): value is string => Boolean(value))
      .flatMap((value) => value.match(/[^.!?]+[.!?]+(?:["'”’)]*)|[^.!?]+$/g) ?? [])
      .filter((value) => value.trim());

    expect(sentences.length).toBeGreaterThanOrEqual(5);
    expect(normalized?.detail).toBe(correction.detail);
    expect(normalized?.whyItMatters).toBe(correction.whyItMatters);
    expect(normalized?.whyItMatters).toMatch(/triceps isolation|joint strain/i);
    expect(normalized?.actionableCorrection?.instruction).toBe(correction.correction);
    expect(normalized?.actionableCorrection?.successCheck).toBe(correction.cue);
  });

  it("keeps unable uploads scoreless instead of applying the viewable-workout fallback", () => {
    expect(resultPayload(
      { detected_label: null, recognition_confidence: 0, recognition_alternatives: [] },
      { status: "unable", video_check: { outcome: "unable", usableObservations: [], limitations: [], retryReason: "No workout is visible.", retryInstruction: "Record a workout set." }, score: null, score_rationale: [], did_well: [], priority_corrections: [], coaching_cues: [], next_set_plan: [], comparison: null },
    )).toMatchObject({ status: "unable", score: null, nextSetPlan: [] });
  });

  it("preserves the analyst score for persisted analyses instead of applying a second cap", () => {
    const recurringImportant = {
      id: "flare",
      title: "Elbow flare",
      detail: "The elbows flare on reps two and four.",
      whyItMatters: "That makes the path less repeatable.",
      correction: "Keep the elbows aligned.",
      cue: "Elbows in.",
      severity: "important",
      evidence: [
        { startMs: 1_000, peakMs: 1_300, endMs: 1_600, repNumber: 2, phase: "concentric", visualEvidence: "The elbows flare.", visibleBodyAreas: ["elbows"], confidence: 0.9 },
        { startMs: 3_000, peakMs: 3_300, endMs: 3_600, repNumber: 4, phase: "concentric", visualEvidence: "The elbows flare again.", visibleBodyAreas: ["elbows"], confidence: 0.9 },
      ],
    };
    const note = { ...recurringImportant, id: "drift", title: "Upper-arm drift", detail: "The upper arm shifts on rep three.", severity: "note", evidence: [recurringImportant.evidence[0]] };
    const payload = resultPayload(
      { detected_label: "Skull Crushers", detected_equipment: ["barbell"], recognition_confidence: 0.9, recognition_alternatives: [], exercise_family: "triceps" },
      { status: "complete", video_check: { outcome: "usable", usableObservations: [], limitations: [], retryReason: null, retryInstruction: null }, overall_assessment: "Two visible issues.", score: 94, score_rationale: [], did_well: [], priority_corrections: [recurringImportant, note], coaching_cues: [], next_set_plan: [], comparison: null },
    );

    expect(payload?.score).toBe(94);
  });

});
