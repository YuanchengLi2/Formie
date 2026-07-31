import type { TutorialVideo } from "../_shared/gemini-tutorial.ts";

const exerciseFamilies = [
  "curl", "triceps", "press", "overhead-press", "fly", "raise", "row", "pull-down",
  "squat", "lunge", "hinge", "hip-thrust", "carry", "core", "plank", "other",
] as const;
type ExerciseFamily = typeof exerciseFamilies[number];

export type ExerciseGuideContent = {
  family: ExerciseFamily;
  setup: string[];
  execution: string[];
  safety: string[];
  cameraPlacement: string[];
};

export type ExerciseGuideSource = {
  id: number | null;
  name: string;
  family: string | null;
  mechanics: Record<string, unknown>;
  criteria: Array<{
    phase: string;
    visibleGood: string;
    coachingCue: string;
    specificity: string;
  }>;
  cachedGuide: ExerciseGuideContent | null;
};

export type ExerciseGuideDependencies = {
  authenticate: (request: Request) => Promise<string>;
  loadExercise: (catalogExerciseId: number) => Promise<ExerciseGuideSource | null>;
  generateGuide: (exercise: ExerciseGuideSource) => Promise<ExerciseGuideContent>;
  saveGuide: (catalogExerciseId: number, guide: ExerciseGuideContent) => Promise<void>;
  findTutorial?: (exerciseName: string) => Promise<TutorialVideo | null>;
};

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function validSteps(value: unknown, maximum: number): value is string[] {
  return Array.isArray(value)
    && value.length >= 1
    && value.length <= maximum
    && value.every((step) => typeof step === "string" && step.trim().length >= 3 && step.length <= 240);
}

export function parseExerciseGuide(value: unknown): ExerciseGuideContent {
  if (!value || typeof value !== "object") throw new Error("INVALID_GUIDE");
  const candidate = value as Record<string, unknown>;
  if (
    !exerciseFamilies.includes(candidate.family as ExerciseFamily)
    || !validSteps(candidate.setup, 6)
    || !validSteps(candidate.execution, 8)
    || !validSteps(candidate.safety, 6)
    || !validSteps(candidate.cameraPlacement, 4)
  ) {
    throw new Error("INVALID_GUIDE");
  }
  return {
    family: candidate.family as ExerciseFamily,
    setup: candidate.setup.map((step) => step.trim()),
    execution: candidate.execution.map((step) => step.trim()),
    safety: candidate.safety.map((step) => step.trim()),
    cameraPlacement: candidate.cameraPlacement.map((step) => step.trim()),
  };
}

export async function exerciseGuideHandler(
  request: Request,
  dependencies: ExerciseGuideDependencies,
): Promise<Response> {
  if (request.method !== "POST") {
    return json({ message: "Method not allowed", code: "METHOD_NOT_ALLOWED" }, 405);
  }

  let catalogExerciseId: unknown;
  let customExerciseName: unknown;
  try {
    ({ catalogExerciseId, customExerciseName } = await request.json() as {
      catalogExerciseId?: unknown;
      customExerciseName?: unknown;
    });
  } catch {
    return json({ message: "A catalog exercise or custom exercise name is required", code: "INVALID_BODY" }, 400);
  }
  const catalogFieldProvided = catalogExerciseId !== undefined;
  const customFieldProvided = customExerciseName !== undefined;
  if (catalogFieldProvided === customFieldProvided) {
    return json({ message: "Provide exactly one catalog exercise or custom exercise name", code: "INVALID_BODY" }, 400);
  }
  const hasCatalogId = Number.isInteger(catalogExerciseId) && Number(catalogExerciseId) > 0;
  const normalizedCustomName = typeof customExerciseName === "string" ? customExerciseName.trim() : "";
  const hasCustomName = normalizedCustomName.length >= 2 && normalizedCustomName.length <= 120;
  if ((catalogFieldProvided && !hasCatalogId) || (customFieldProvided && !hasCustomName)) {
    return json({ message: "The exercise selection is invalid", code: "INVALID_BODY" }, 400);
  }

  try {
    await dependencies.authenticate(request);
    const exercise = hasCatalogId
      ? await dependencies.loadExercise(Number(catalogExerciseId))
      : {
          id: null,
          name: normalizedCustomName,
          family: null,
          mechanics: {},
          criteria: [],
          cachedGuide: null,
        };
    if (!exercise) return json({ message: "Exercise not found", code: "NOT_FOUND" }, 404);

    const guide = exercise.cachedGuide
      ? parseExerciseGuide(exercise.cachedGuide)
      : parseExerciseGuide(await dependencies.generateGuide(exercise));
    if (!exercise.cachedGuide && exercise.id !== null) await dependencies.saveGuide(exercise.id, guide);
    const tutorial = dependencies.findTutorial
      ? await dependencies.findTutorial(exercise.name).catch(() => null)
      : null;

    return json({
      exercise: {
        catalogExerciseId: exercise.id,
        canonicalName: exercise.name,
        family: guide.family,
      },
      ...guide,
      tutorial,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return json({ message: "Sign in again", code: "UNAUTHORIZED" }, 401);
    }
    return json({ message: "The exercise guide is temporarily unavailable", code: "GUIDE_FAILED" }, 502);
  }
}
