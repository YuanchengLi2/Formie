import type { AnalysisCandidate, EvidenceMoment } from "../_shared/analysis-contract.ts";
import type { SetDeclaration } from "../_shared/set-declaration.ts";
import type { CatalogContext, CoachingWriterResult } from "./coaching-writer.ts";
import type { ProblemFinderProblem } from "./problem-finder.ts";

export function mapV49Result(input: { declaration: SetDeclaration; catalogContext: CatalogContext; problems: ProblemFinderProblem[]; writing: CoachingWriterResult }): AnalysisCandidate {
  const problemById = new Map(input.problems.map((problem) => [problem.id, problem]));
  const priorityCorrections = input.writing.corrections.map((written) => {
    const problem = problemById.get(written.problemId);
    if (!problem) throw new Error(`Writer referenced unknown problem ${written.problemId}`);
    const evidence: EvidenceMoment[] = problem.evidence.map((moment) => ({ ...moment, repNumber: null, phase: null, visibleBodyAreas: [...written.observedIssueRegions], coachingNote: moment.visualEvidence, focusRegion: null }));
    return {
      id: problem.id,
      coachingType: "correction" as const,
      coachingArea: written.coachingArea,
      title: written.title,
      detail: problem.observation,
      whyItMatters: written.whyItMatters,
      correction: written.whatToDo,
      cue: written.whatToDo,
      actionableCorrection: { instruction: written.whatToDo, cue: written.whatToDo, successCheck: written.successCheck, applyWhen: "During the next set" },
      expandedCoaching: { summary: written.title, whatHappened: written.whatHappened, whyItMatters: written.whyItMatters, whatToDo: written.whatToDo, successCheck: written.successCheck },
      severity: written.severity,
      evidence,
      primaryEvidenceIndex: 0,
      observedIssueRegions: [...written.observedIssueRegions],
    };
  });
  return {
    status: "complete",
    analysisBasis: "observed",
    viewNotes: [],
    generalGuidance: [],
    recognition: { label: input.declaration.exercise.label, variation: null, equipment: [...input.catalogContext.equipment], confidence: 1, alternatives: [], catalogExerciseId: input.declaration.exercise.catalogExerciseId, exerciseFamily: input.catalogContext.family ?? "other", source: "user_declared" },
    overallAssessment: input.writing.overallAssessment,
    muscleFocus: input.writing.muscleFocus,
    coachNote: input.writing.coachNote,
    score: input.writing.score,
    scoreRationale: input.writing.movementScores.map((score) => ({ criterion: score.id, observed: score.observed, impact: score.score, confidence: 1, evidenceIds: [...score.evidenceIds] })),
    movementScores: input.writing.movementScores,
    scorecard: null,
    equipmentObservations: [],
    exerciseGuide: null,
    didWell: [],
    priorityCorrections,
    coachingCues: [],
    setContext: { cameraView: null, visibleReferences: [], sequenceSummary: null, changeAcrossSet: null, coachingBasis: `Problems identified from the complete ${input.declaration.exercise.label} recording.` },
    setSummary: {
      totalReps: input.declaration.amount.kind === "reps" ? input.declaration.amount.value : null,
      consistentReps: null,
      verdict: input.writing.setSummary.verdict,
    },
    nextSetPlan: input.writing.nextSetPlan.map((item) => ({ id: `next-${item.problemId}`, action: item.action, rationale: item.rationale, successCheck: item.successCheck, relatedFindingId: item.problemId })),
    precisionRequest: { requestedRuns: 0, reason: null, targets: [] },
    comparison: null,
    setDeclaration: input.declaration,
  };
}
