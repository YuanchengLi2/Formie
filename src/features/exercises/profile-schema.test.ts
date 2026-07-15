import { EXERCISES } from "./catalog";
import { exerciseProfileSchema } from "./profile-schema";

describe("exerciseProfileSchema", () => {
  it("accepts every launch profile", () => {
    for (const exercise of EXERCISES) {
      expect(exerciseProfileSchema.safeParse(exercise.profile).success).toBe(true);
    }
  });

  it("rejects a profile with no visible landmarks", () => {
    const profile = structuredClone(EXERCISES[0].profile);
    profile.camera.requiredLandmarks = [];
    expect(exerciseProfileSchema.safeParse(profile).success).toBe(false);
  });

  it("requires the profile to preserve open-ended analysis", () => {
    const profile = structuredClone(EXERCISES[0].profile);
    profile.analysisInstruction = "Only check the faults in this profile.";
    expect(exerciseProfileSchema.safeParse(profile).success).toBe(false);
  });
});
