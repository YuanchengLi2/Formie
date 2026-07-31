import type { CoachMessage } from "./coach-contract.ts";
import type { CoachEvidenceSelection } from "./coach-contract.ts";
import type { CoachLocation } from "./coach-analysis.ts";

export type ResolvedCoachEvidence = {
  findingId: string;
  title: string;
  detail: string;
  peakMs: number;
  repNumber: number | null;
  phase: string | null;
  visualEvidence: string;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

export function resolveCoachEvidence(analysis: unknown, selection: CoachEvidenceSelection): ResolvedCoachEvidence {
  const result = asRecord(analysis);
  const findingGroups = result ? [result.priorityCorrections, result.didWell, result.coachingCues] : [];
  for (const group of findingGroups) {
    if (!Array.isArray(group)) continue;
    const finding = group.map(asRecord).find((item) => item?.id === selection.findingId);
    if (!finding || !Array.isArray(finding.evidence)) continue;
    const evidence = finding.evidence.map(asRecord).find((item) => item?.peakMs === selection.peakMs);
    if (!evidence) continue;
    return {
      findingId: selection.findingId,
      title: typeof finding.title === "string" ? finding.title : "Selected coaching moment",
      detail: typeof finding.detail === "string" ? finding.detail : "",
      peakMs: selection.peakMs,
      repNumber: Number.isInteger(evidence.repNumber) ? Number(evidence.repNumber) : null,
      phase: typeof evidence.phase === "string" ? evidence.phase : null,
      visualEvidence: typeof evidence.visualEvidence === "string" ? evidence.visualEvidence : "",
    };
  }
  throw new Error("Selected evidence is unavailable in this analysis");
}

export const VIDEO_COACH_SAFETY = `Discuss only mechanics visible in the selected recording and the supplied verified analysis.
You may explain how visible setup can bias an exercise toward a target muscle, but never claim measured muscle activation.
Do not diagnose pain, injury, disease, or joint loading. If the question needs evidence the video does not show, say that clearly.
Never invent visibility, timestamps, body positions, or outcomes not supported by the recording.
Use the selected recording as one continuous set, together with setContext, repTimeline, findings, and evidence moments.
Use the same phase across repetitions to distinguish an isolated event from a set-wide pattern before generalizing advice.
For front or down-front footage, use only visible relative-depth cues such as shoulder or implement travel against stable equipment, endpoint changes, spacing, overlap, and support contact. Never invent metric 3D depth, distance, or joint angles.
Use timestamps when referring to a specific visible moment. Give one practical next-set action at a time.`;

export function buildCoachPrompt(input: { analysis: unknown; selectedEvidence?: ResolvedCoachEvidence | null; targetIntent?: string | null; history: CoachMessage[]; message: string }): string {
  const history = input.history.slice(-20).map(({ role, content }) => ({ role, content }));
  return `${VIDEO_COACH_SAFETY}

Lead with a direct answer to the current question. Use timestamps only for moments supported by the selected recording or supplied analysis. Finish with one practical next-set action when coaching is appropriate.

Selected analysis:
${JSON.stringify(input.analysis)}

Selected evidence focus:
${input.selectedEvidence ? JSON.stringify(input.selectedEvidence) : "No specific evidence selected"}

Target muscle or movement intent: ${input.targetIntent?.trim() || "Not specified"}
Saved conversation (oldest to newest, maximum 20):
${JSON.stringify(history)}

Current user question:
${input.message.trim()}`;
}

function conversation(history: CoachMessage[]) {
  return JSON.stringify(history.slice(-20).map(({ role, content }) => ({ role, content })));
}

export function buildCoachLocatorPrompt(input: { analysis: unknown; selectedEvidence?: ResolvedCoachEvidence | null; targetIntent?: string | null; history: CoachMessage[]; message: string; durationMs: number }): string {
  return `${VIDEO_COACH_SAFETY}

Locate the portion of the original recording needed to answer the current question.
Return focused_window when the user refers to a repetition, timestamp, phase, visible event, or localized movement. Return the narrow event interval on the original timeline in integer milliseconds; the server adds surrounding context.
Return whole_set when answering requires comparing repetitions or reviewing the complete set.
Return insufficient only when the user's reference cannot be resolved from the recording, saved analysis, or conversation. Ask one concise clarification.
Field rules are exact:
- focused_window: startMs and endMs MUST both be integers on the original-video timeline; clarification MUST be null.
- whole_set: startMs and endMs MUST both be null; clarification MUST be null.
- insufficient: startMs and endMs MUST both be null; clarification MUST contain the question to ask.
Do not answer the coaching question in this step.

Recording duration in milliseconds: ${input.durationMs}
Saved analysis (context, not an exhaustive limit):
${JSON.stringify(input.analysis)}
Legacy selected evidence hint:
${input.selectedEvidence ? JSON.stringify(input.selectedEvidence) : "None"}
Target intent: ${input.targetIntent?.trim() || "Not specified"}
Previous conversation only:
${conversation(input.history)}

Current user question:
${input.message.trim()}`;
}

export function buildCoachAnswerPrompt(input: { analysis: unknown; targetIntent?: string | null; history: CoachMessage[]; message: string; durationMs: number; location: CoachLocation }): string {
  const reviewedDurationMs = input.location.scope === "focused_window"
    ? Number(input.location.endMs) - Number(input.location.startMs)
    : input.durationMs;
  if (!Number.isInteger(reviewedDurationMs) || reviewedDurationMs <= 0) throw new Error("Reviewed media duration is invalid");
  return `${VIDEO_COACH_SAFETY}

Answer the current question from the supplied original recording or reviewed clip.
Lead with a direct answer. The saved analysis is useful context but is not exhaustive: you may make a new visible observation when the pixels support it.
Never change or recalculate the saved score, rewrite saved findings, or imply that this chat updates the saved analysis.
If the requested fact is not visually measurable (including exact load, internal force, tissue state, pain diagnosis, muscle activation, or pressure distribution), answer that limitation directly. For a purely unanswerable request, return no observation citations and no next-set action unless the user explicitly asks for a visible alternative. Do not add causal claims about internal stress, tissue loading, injury prevention, or muscle bias.
Describe visible motion in plain external terms. Do not explain a visible compensation by naming which muscle took over, became fatigued, compensated, or was isolated.
For every cited observation, return offsetMs relative to the beginning of the supplied reviewed media. offsetMs 0 is the first frame of the media supplied to this request. The largest allowed offsetMs is ${reviewedDurationMs}. Never return an original-video timestamp for a clipped request. The server converts valid offsets to the original-video timeline.
State genuine visibility limitations. Provide one practical next-set action when coaching is appropriate.

Resolved review scope: ${input.location.scope}
Reviewed media duration in milliseconds: ${reviewedDurationMs}
Location rationale: ${input.location.rationale}
Saved analysis:
${JSON.stringify(input.analysis)}
Target intent: ${input.targetIntent?.trim() || "Not specified"}
Previous conversation only:
${conversation(input.history)}

Current user question:
${input.message.trim()}`;
}
