import type { AnalysisHistoryItem, AnalysisHistoryStatus } from "./group-sessions";
import { isExerciseFamily } from "@/features/exercises/exercise-family";

type QueryResult = { data: unknown[] | null; error: { message: string } | null };
type HistoryQuery = () => Promise<QueryResult>;

type HistoryResultRow = {
  score?: number | string | null;
  priority_corrections?: { title?: string }[] | null;
  comparison?: { summary?: string; priorityIssueImproved?: boolean | null; priority_issue_improved?: boolean | null } | null;
};

type HistoryRow = {
  id: string;
  status: AnalysisHistoryStatus;
  created_at: string;
  detected_label: string | null;
  corrected_label: string | null;
  exercise_family?: string | null;
  analysis_results: HistoryResultRow | HistoryResultRow[] | null;
};

async function defaultHistoryQuery(): Promise<QueryResult> {
  const { supabase } = await import("@/lib/supabase");
  return supabase
    .from("analysis_sessions")
    .select("id,status,created_at,detected_label,corrected_label,exercise_family,analysis_results(score,priority_corrections,comparison)")
    .in("status", ["processing", "complete", "partial", "unable"])
    .order("created_at", { ascending: false })
    .limit(100);
}

export async function fetchAnalysisHistory({ query = defaultHistoryQuery }: { query?: HistoryQuery } = {}): Promise<AnalysisHistoryItem[]> {
  const { data, error } = await query();
  if (error) throw new Error(error.message);
  return ((data ?? []) as HistoryRow[]).map((row) => {
    const nested = Array.isArray(row.analysis_results) ? row.analysis_results[0] : row.analysis_results;
    const rawScore = nested?.score;
    const score = rawScore === null || rawScore === undefined ? null : Number(rawScore);
    return {
      sessionId: row.id,
      status: row.status,
      createdAt: row.created_at,
      detectedLabel: row.detected_label,
      correctedLabel: row.corrected_label,
      exerciseFamily: isExerciseFamily(row.exercise_family) ? row.exercise_family : null,
      score,
      priorityCorrectionTitles: (nested?.priority_corrections ?? []).map((finding) => finding.title).filter((title): title is string => Boolean(title)),
      comparisonSummary: nested?.comparison?.summary ?? null,
      priorityIssueImproved: nested?.comparison?.priorityIssueImproved ?? nested?.comparison?.priority_issue_improved ?? null,
    };
  });
}
