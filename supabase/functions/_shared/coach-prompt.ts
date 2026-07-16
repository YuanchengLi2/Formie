import type { CoachMessage } from "./coach-contract.ts";

export const VIDEO_COACH_SAFETY = `Discuss only mechanics visible in the selected recording and the supplied verified analysis.
You may explain how visible setup can bias an exercise toward a target muscle, but never claim measured muscle activation.
Do not diagnose pain, injury, disease, or joint loading. If the question needs evidence the video does not show, say that clearly.
Never invent visibility, timestamps, body positions, or outcomes not supported by the recording.
Use timestamps when referring to a specific visible moment. Give one practical next-set action at a time.`;

export function buildCoachPrompt(input: { analysis: unknown; targetIntent?: string | null; history: CoachMessage[]; message: string }): string {
  const history = input.history.slice(-20).map(({ role, content }) => ({ role, content }));
  return `${VIDEO_COACH_SAFETY}

Selected analysis:
${JSON.stringify(input.analysis)}

Target muscle or movement intent: ${input.targetIntent?.trim() || "Not specified"}
Saved conversation (oldest to newest, maximum 20):
${JSON.stringify(history)}

Current user question:
${input.message.trim()}`;
}
