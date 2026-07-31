import type { ExerciseGuide } from "@/features/analysis/api";

import {
  createExerciseGuideStore,
  type ExerciseGuideStoreAdapter,
} from "./exercise-guide-store";

const guide: ExerciseGuide = {
  exercise: {
    catalogExerciseId: null,
    canonicalName: "Seated One-Arm Dumbbell Extension",
    family: "triceps",
  },
  setup: ["Sit upright with the dumbbell overhead."],
  execution: ["Bend and straighten the working elbow."],
  safety: ["Use a load you can control."],
  cameraPlacement: ["Keep the working shoulder, elbow, wrist, and dumbbell visible."],
  tutorial: null,
};

function adapter(initial: unknown = null): ExerciseGuideStoreAdapter {
  let contents = initial;
  return {
    read: jest.fn(async () => contents),
    write: jest.fn(async (next) => {
      contents = next;
    }),
  };
}

describe("exercise guide store", () => {
  it("reuses a generated custom guide from durable storage after restart", async () => {
    const storage = adapter();
    await createExerciseGuideStore(storage).save("custom:seated one-arm dumbbell extension", guide);

    await expect(
      createExerciseGuideStore(storage).find("custom:seated one-arm dumbbell extension"),
    ).resolves.toEqual(guide);
  });

  it("ignores invalid or mismatched persisted guide data", async () => {
    const storage = adapter({
      version: 1,
      entries: {
        "custom:bad": { guide: { exercise: {} }, updatedAt: Date.now() },
      },
    });

    await expect(createExerciseGuideStore(storage).find("custom:bad")).resolves.toBeNull();
  });
});
