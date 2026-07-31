export type PlaybackWindow = {
  sourceStartMs: number;
  sourceEndMs: number;
};

type SessionWithAnalysisDraft = {
  duration_ms?: unknown;
  analysis_draft?: unknown;
};

export function playbackWindowFromSession(session: SessionWithAnalysisDraft): PlaybackWindow | null {
  if (!Number.isInteger(session.duration_ms) || Number(session.duration_ms) <= 0) return null;
  if (!session.analysis_draft || typeof session.analysis_draft !== "object" || Array.isArray(session.analysis_draft)) return null;
  const coverage = (session.analysis_draft as Record<string, unknown>).wholeSetCoverage;
  if (!coverage || typeof coverage !== "object" || Array.isArray(coverage)) return null;
  const { activeSetStartMs, activeSetEndMs } = coverage as Record<string, unknown>;
  if (
    !Number.isInteger(activeSetStartMs) ||
    !Number.isInteger(activeSetEndMs) ||
    Number(activeSetStartMs) < 0 ||
    Number(activeSetEndMs) <= Number(activeSetStartMs) ||
    Number(activeSetEndMs) > Number(session.duration_ms)
  ) return null;
  return {
    sourceStartMs: Number(activeSetStartMs),
    sourceEndMs: Number(activeSetEndMs),
  };
}
