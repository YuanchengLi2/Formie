export type ScoreCriterionKey = "setup_stability" | "path_alignment" | "range_positions" | "control_tempo" | "rep_consistency";
export type ExerciseFamily = "curl" | "triceps" | "press" | "overhead-press" | "fly" | "raise" | "row" | "pull-down" | "squat" | "lunge" | "hinge" | "hip-thrust" | "carry" | "core" | "plank" | "other";
export type MuscleRegion = "chest" | "front_shoulders" | "rear_shoulders" | "upper_back" | "lats" | "biceps" | "triceps" | "forearms" | "abs" | "obliques" | "lower_back" | "glutes" | "quads" | "hamstrings" | "adductors" | "calves";
export type AnatomyRegion = "chest" | "shoulders" | "upper_back" | "lats" | "upper_arms" | "elbows" | "forearms" | "wrists" | "torso" | "lower_back" | "hips" | "glutes" | "quads" | "hamstrings" | "adductors" | "knees" | "calves" | "ankles";
export type MovementScore = {
  id: string;
  label: string;
  score: number;
  observed: string;
  evidenceIds: string[];
};
export type MuscleTarget = { name: string; region: MuscleRegion };
export type MuscleFocus = {
  primary: MuscleTarget[];
  secondary: MuscleTarget[];
  unclassified: string[];
};

export type CoachingArea =
  | "form"
  | "load"
  | "posture_setup"
  | "equipment"
  | "safety_surroundings"
  | "grip_contact"
  | "support_balance";

export type EvidenceMoment = {
  startMs: number;
  peakMs: number;
  endMs: number;
  repNumber: number | null;
  phase: string | null;
  visualEvidence: string;
  coachingNote?: string;
  visibleBodyAreas: string[];
  confidence: number;
  measurementIds?: string[];
  focusRegion?: { centerX: number; centerY: number; radius: number; arrowFromX: number; arrowFromY: number; label: string; confidence: number } | null;
};

export type CoachingFinding = {
  id: string;
  coachingType?: "correction" | "optimization";
  coachingArea: CoachingArea;
  title: string;
  detail: string;
  whyItMatters: string;
  correction: string | null;
  cue: string | null;
  actionableCorrection: { instruction: string; cue: string; successCheck: string | null; applyWhen: string } | null;
  expandedCoaching?: {
    summary: string;
    whatHappened: string;
    whyItMatters: string;
    whatToDo: string;
    successCheck: string | null;
  };
  severity: "note" | "important" | "high";
  evidence: EvidenceMoment[];
  primaryEvidenceIndex?: number;
  observedIssueRegions?: AnatomyRegion[];
};

export type EquipmentObservation = {
  id: string;
  category: "visible_load" | "setup" | "balance" | "equipment_motion" | "limitation";
  title: string;
  observation: string;
  coachingRelevance: string | null;
  load: { value: number | null; unit: "kg" | "lb" | null; scope: string | null; certainty: "exact_visible" | "partial_visible" | "unknown"; basis: "readable_label" | "readable_selector" | "counted_visible_plates" | "not_readable" } | null;
  evidence: Array<{ startMs: number; peakMs: number; endMs: number; visualEvidence: string; visibleReferences: string[]; confidence: number; focusRegion: EvidenceMoment["focusRegion"] }>;
};

export type CoachingCoverageDomain =
  | "surroundings"
  | "equipment_setup"
  | "grip_contact"
  | "starting_position"
  | "movement_execution"
  | "support_balance";

export type CoachingCoverageItem = {
  domain: CoachingCoverageDomain;
  status: "issue" | "clear" | "not_visible";
  observation: string;
  findingIds: string[];
};

export type ExerciseGuide = {
  setupSteps: string[];
  executionSteps: string[];
  relatedFindingIds: string[];
};

export type TechniqueScorecard = {
  rubricVersion: string;
  coverage: number;
  confidence: number;
  criteria: Array<{ key: ScoreCriterionKey; weight: number; rating: number | null; confidence: number; observed: string; evidenceIds: string[] }>;
  uncappedScore: number | null;
  appliedCap: number | null;
  finalScore: number | null;
  auditStatus: string;
};

export type AnalysisCandidate = {
  status: "complete" | "partial" | "unable";
  /** Whole-video provenance. Historical candidates may omit these fields. */
  analysisBasis?: "observed" | "declared_only";
  viewNotes?: string[];
  generalGuidance?: string[];
  recognition: { label: string | null; variation: string | null; equipment: string[]; confidence: number; alternatives: string[]; catalogExerciseId: number | null; exerciseFamily: ExerciseFamily; source?: "user_declared" | "legacy_model" };
  /** Historical result compatibility. The active pipeline exposes analysisBasis/viewNotes instead. */
  videoCheck?: { outcome: "usable" | "partial" | "unable"; usableObservations: string[]; limitations: string[]; retryReason: string | null; retryInstruction: string | null };
  overallAssessment: string | null;
  muscleFocus: MuscleFocus;
  coachNote: string | null;
  score: number | null;
  scoreRationale: Array<{ criterion: string; observed: string; impact: number | null; confidence: number; evidenceIds: string[] }>;
  movementScores?: MovementScore[];
  scorecard: TechniqueScorecard | null;
  equipmentObservations: EquipmentObservation[];
  exerciseGuide?: ExerciseGuide | null;
  coachingCoverage?: CoachingCoverageItem[];
  didWell: CoachingFinding[];
  priorityCorrections: CoachingFinding[];
  coachingCues: CoachingFinding[];
  setContext: { cameraView: string | null; visibleReferences: string[]; sequenceSummary: string | null; changeAcrossSet: string | null; coachingBasis: string | null };
  setSummary: { totalReps: number | null; consistentReps: number | null; verdict: string | null };
  /** Historical result compatibility. v46 does not publish a rep timeline. */
  repTimeline?: Array<{ repNumber: number; startMs: number; peakMs: number; endMs: number; assessment: "strong" | "consistent" | "breakdown" | "uncertain"; note: string }>;
  nextSetPlan: Array<{ id: string; action: string; rationale: string; successCheck?: string; relatedFindingId: string | null }>;
  precisionRequest: { requestedRuns: number; reason: string | null; targets: Array<{ kind: "recognition" | "timestamp" | "technique"; findingId: string | null; startMs: number | null; endMs: number | null; question: string }> };
  comparison: { previousSessionId: string; summary: string; priorityIssueImproved: boolean | null } | null;
  setDeclaration?: import("./set-declaration.ts").SetDeclaration | null;
};
