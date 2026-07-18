export type CompactExerciseProfile = {
  id: number;
  name: string;
  aliases: string[];
  phases: string[];
  attentionAreas: string[];
  commonFaults: string[];
};

export type PromptInput = {
  profiles: CompactExerciseProfile[];
  previousResult: unknown | null;
};

function compactPreviousResult(value: unknown): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const result = value as Record<string, unknown>;
  return {
    recognition: result.recognition ?? null,
    overallAssessment: result.overallAssessment ?? null,
    setSummary: result.setSummary ?? null,
    setContext: result.setContext ?? null,
    priorityCorrections: result.priorityCorrections ?? [],
    coachingCues: result.coachingCues ?? [],
    nextSetPlan: result.nextSetPlan ?? [],
  };
}

export function buildAnalysisPrompt(input: PromptInput): string {
  const catalog = input.profiles.map(({ id, name, aliases }) => ({ id, name, aliases }));
  const previousResult = compactPreviousResult(input.previousResult);

  return `You are FORM, an expert strength-training coach. Watch the entire original video from beginning to end before answering. Return one JSON object matching the supplied schema.

Use your own visual reasoning. Analyze the exercise and its visible surroundings naturally and independently. Report all useful visible coaching: safety issues, setup problems, technique errors, subtle movement details, strengths, and practical improvements. There is no numeric limit on genuine findings. Do not stop after the first few issues, but do not invent problems or add filler.

CORE RESULT
- Identify the closest established exercise even when execution is unusual or incorrect. Use the catalog ID when a listed exercise clearly matches; the catalog is identity guidance, not a checklist of faults.
- Account for the complete sequence: entry and setup, every distinguishable full or partial repetition, changes across the set, and the finish or rerack. Keep setSummary.totalReps and repTimeline consistent. Only describe fatigue when repeated visible deterioration develops later in the set.
- Provide the overall assessment, genuine strengths, every useful priorityCorrections item, useful coachingCues, and a short actionable nextSetPlan. Explain what is visibly happening and how to improve it.
- Ground each finding in evidence from this video using startMs, peakMs, endMs, repNumber when applicable, visibleBodyAreas, confidence, visualEvidence, and coachingNote. Use current-video milliseconds. Add focusRegion in normalized original-frame coordinates when the exact visible target can be localized confidently; otherwise use null.
- Use videoCheck.limitations for anything the recording cannot actually establish. Distinguish uncertain or hidden from visibly correct.

SPATIAL AND CAMERA REASONING
First infer the camera direction and angle from the person, equipment, supports, and movement. Account for mirroring, foreshortening, perspective distortion, occlusion, overlap, apparent-size changes, and wide-angle effects before judging symmetry, rotation, depth, range, or path. Compare body parts and equipment against stable visible references and compare the same movement phase across repetitions. Front, side, diagonal, high, low, and partially obstructed views can each support different observations. Use every reliable relationship the view provides. Do not invent precise 3D depth, distances, or joint angles from a single 2D video.

CONTEXT
Exercise catalog: ${JSON.stringify(catalog)}
Previous linked result: ${JSON.stringify(previousResult)}
Previous-set timestamps are not evidence for this video. Use the earlier result only to compare coaching patterns, and support every current conclusion with the current video.

Keep recognition, setContext, setSummary, repTimeline, findings, comparison, and nextSetPlan consistent with one another. Set precisionRequest.requestedRuns to 0 unless one important uncertainty truly needs one focused review; then request exactly one target. Do not turn camera angle or recording setup into coaching advice. Do not claim pain, measured muscle activation, internal force, or anything else the video cannot show.

Return unable only when there is no meaningful analyzable human movement. For unable results, return no coaching findings, use empty arrays and null result fields where the schema permits them, and provide a specific retryReason and retryInstruction.`;
}
