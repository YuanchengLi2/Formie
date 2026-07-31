import type { MuscleFocus, MuscleRegion } from "./result-schema";

type Target = { name: string; region: MuscleRegion };

const target = (name: string, region: MuscleRegion): Target => ({ name, region });
const focus = (primary: Target[], secondary: Target[] = []): MuscleFocus => ({
  primary,
  secondary,
  unclassified: [],
});

const CHEST = target("Pectorals", "chest");
const FRONT_SHOULDERS = target("Front shoulders", "front_shoulders");
const REAR_SHOULDERS = target("Rear shoulders", "rear_shoulders");
const UPPER_BACK = target("Upper back", "upper_back");
const LATS = target("Latissimus dorsi", "lats");
const BICEPS = target("Biceps", "biceps");
const TRICEPS = target("Triceps", "triceps");
const FOREARMS = target("Forearms", "forearms");
const ABS = target("Abdominals", "abs");
const OBLIQUES = target("Obliques", "obliques");
const LOWER_BACK = target("Lower back", "lower_back");
const GLUTES = target("Glutes", "glutes");
const QUADS = target("Quadriceps", "quads");
const HAMSTRINGS = target("Hamstrings", "hamstrings");
const ADDUCTORS = target("Adductors", "adductors");
const CALVES = target("Calves", "calves");

export function resolveExerciseMuscleFocus(exerciseLabel: string): MuscleFocus | null {
  const name = exerciseLabel.toLocaleLowerCase().replace(/[-_/]/g, " ").replace(/\s+/g, " ").trim();
  if (!name) return null;

  if (/\b(?:romanian deadlift|rdl|stiff leg deadlift|good morning)\b/.test(name)) {
    return focus([HAMSTRINGS, GLUTES], [LOWER_BACK, ADDUCTORS]);
  }
  if (/\b(?:deadlift|rack pull|hip hinge)\b/.test(name)) {
    return focus([GLUTES, HAMSTRINGS], [LOWER_BACK, QUADS]);
  }
  if (/\b(?:hip thrust|glute bridge|kickback)\b/.test(name)) {
    return focus([GLUTES], [HAMSTRINGS]);
  }
  if (/\b(?:leg curl|hamstring curl|nordic curl)\b/.test(name)) {
    return focus([HAMSTRINGS], [GLUTES, CALVES]);
  }
  if (/\b(?:calf raise|calves)\b/.test(name)) return focus([CALVES]);
  if (/\b(?:squat|lunge|split squat|step up|leg press|hack squat)\b/.test(name)) {
    return focus([QUADS, GLUTES], [HAMSTRINGS, ADDUCTORS]);
  }
  if (/\b(?:leg extension|sissy squat)\b/.test(name)) return focus([QUADS]);

  if (/\b(?:pull up|chin up|pulldown|lat pull)\b/.test(name)) {
    return focus([LATS, UPPER_BACK], [BICEPS, REAR_SHOULDERS]);
  }
  if (/\b(?:row|seal row|high pull)\b/.test(name)) {
    return focus([LATS, UPPER_BACK], [REAR_SHOULDERS, BICEPS]);
  }
  if (/\b(?:reverse fly|rear delt|face pull)\b/.test(name)) {
    return focus([REAR_SHOULDERS, UPPER_BACK], [LATS]);
  }
  if (/\b(?:shrug)\b/.test(name)) return focus([UPPER_BACK], [FOREARMS]);

  if (/\b(?:bench press|chest press|floor press|push up|pushup|dip)\b/.test(name)) {
    return focus([CHEST], [FRONT_SHOULDERS, TRICEPS]);
  }
  if (/\b(?:chest fly|pec fly|cable fly|dumbbell fly)\b/.test(name)) {
    return focus([CHEST], [FRONT_SHOULDERS]);
  }
  if (/\b(?:overhead press|shoulder press|military press|arnold press|push press)\b/.test(name)) {
    return focus([FRONT_SHOULDERS, TRICEPS], [UPPER_BACK]);
  }
  if (/\b(?:lateral raise|front raise)\b/.test(name)) {
    return focus([FRONT_SHOULDERS], [UPPER_BACK]);
  }
  if (/\b(?:triceps|pushdown|skull crusher|close grip press)\b/.test(name)) {
    return focus([TRICEPS], [FRONT_SHOULDERS]);
  }
  if (/\b(?:curl|biceps)\b/.test(name)) return focus([BICEPS], [FOREARMS]);

  if (/\b(?:plank|crunch|sit up|ab wheel|leg raise|dead bug|hollow hold)\b/.test(name)) {
    return focus([ABS], [OBLIQUES]);
  }
  if (/\b(?:russian twist|side plank|woodchop|pallof)\b/.test(name)) {
    return focus([OBLIQUES], [ABS]);
  }
  if (/\b(?:farmer carry|suitcase carry|loaded carry)\b/.test(name)) {
    return focus([FOREARMS, UPPER_BACK], [ABS, OBLIQUES]);
  }

  return null;
}
