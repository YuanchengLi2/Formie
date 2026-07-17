import { formatExerciseFamily, inferExerciseFamily, type ExerciseFamily } from "@/features/exercises/exercise-family";

export type AnalysisHistoryStatus = "processing" | "complete" | "partial" | "unable";

export type AnalysisHistoryItem = {
  sessionId: string;
  status: AnalysisHistoryStatus;
  createdAt: string;
  detectedLabel: string | null;
  correctedLabel: string | null;
  pinnedAt?: string | null;
  exerciseFamily?: ExerciseFamily | null;
  score: number | null;
  priorityCorrectionTitles: string[];
  comparisonSummary: string | null;
  priorityIssueImproved: boolean | null;
};

export type AnalysisHistoryGroup = {
  key: string;
  label: string;
  sessions: AnalysisHistoryItem[];
  scoreTrend: { sessionId: string; createdAt: string; score: number }[];
  recurringCorrections: { title: string; count: number }[];
  improvements: string[];
  exerciseFamily: ExerciseFamily;
};

export function normalizeExerciseLabel(label: string): string {
  return label.trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

export function groupAnalysisSessions(items: AnalysisHistoryItem[]): AnalysisHistoryGroup[] {
  const sorted = [...items].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  const groups = new Map<string, AnalysisHistoryGroup>();
  for (const item of sorted) {
    const effectiveLabel = item.correctedLabel?.trim() || item.detectedLabel?.trim() || "Unidentified movement";
    const exerciseFamily = item.exerciseFamily ?? inferExerciseFamily(effectiveLabel);
    const key = exerciseFamily;
    const group = groups.get(key) ?? { key, label: formatExerciseFamily(exerciseFamily), exerciseFamily, sessions: [], scoreTrend: [], recurringCorrections: [], improvements: [] };
    group.sessions.push(item);
    if (item.score !== null) group.scoreTrend.push({ sessionId: item.sessionId, createdAt: item.createdAt, score: item.score });
    if (item.priorityIssueImproved && item.comparisonSummary) group.improvements.push(item.comparisonSummary);
    groups.set(key, group);
  }

  for (const group of groups.values()) {
    const counts = new Map<string, number>();
    for (const session of group.sessions) {
      for (const title of new Set(session.priorityCorrectionTitles)) counts.set(title, (counts.get(title) ?? 0) + 1);
    }
    group.recurringCorrections = [...counts.entries()]
      .map(([title, count]) => ({ title, count }))
      .filter(({ count }) => group.sessions.length === 1 || count > 1)
      .sort((left, right) => right.count - left.count || left.title.localeCompare(right.title));
  }
  return [...groups.values()];
}
