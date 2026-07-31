type JsonRecord = Record<string, unknown>;

function record(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as JsonRecord
    : null;
}

function shiftField(value: JsonRecord, key: string, offsetMs: number) {
  if (typeof value[key] === "number" && Number.isFinite(value[key])) {
    value[key] = Number(value[key]) + offsetMs;
  }
}

function shiftWindow(value: unknown, offsetMs: number) {
  const item = record(value);
  if (!item) return;
  shiftField(item, "startMs", offsetMs);
  shiftField(item, "peakMs", offsetMs);
  shiftField(item, "endMs", offsetMs);
}

export function rebaseAnalysisDecisionTimestamps<T>(decision: T, offsetMs: number): T {
  if (!Number.isInteger(offsetMs) || offsetMs < 0) throw new Error("offsetMs must be a non-negative integer");
  if (offsetMs === 0) return decision;
  const shifted = JSON.parse(JSON.stringify(decision)) as T;
  const root = record(shifted);
  if (!root) return shifted;

  for (const finding of Array.isArray(root.findings) ? root.findings : []) {
    const findingRecord = record(finding);
    for (const evidence of findingRecord && Array.isArray(findingRecord.evidence) ? findingRecord.evidence : []) {
      shiftWindow(evidence, offsetMs);
    }
  }
  for (const rep of Array.isArray(root.repTimeline) ? root.repTimeline : []) shiftWindow(rep, offsetMs);

  const coverage = record(root.wholeSetCoverage);
  if (coverage) {
    shiftField(coverage, "activeSetStartMs", offsetMs);
    shiftField(coverage, "activeSetEndMs", offsetMs);
    for (const checkpoint of Array.isArray(coverage.checkpoints) ? coverage.checkpoints : []) {
      shiftWindow(checkpoint, offsetMs);
    }
  }

  return shifted;
}
