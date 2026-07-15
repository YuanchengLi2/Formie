export type ExerciseCategory = "Chest" | "Back" | "Legs" | "Shoulders" | "Arms" | "Core";

export type CameraView = "front" | "side" | "rear" | "front-45" | "rear-45";

export type ExerciseFaultContext = {
  observation: string;
  whyItMatters: string;
  cue: string;
};

export type ExerciseProfile = {
  camera: {
    preferredView: CameraView;
    alternatives: CameraView[];
    requiredLandmarks: string[];
    distanceMeters: [number, number];
  };
  phases: string[];
  attentionAreas: string[];
  commonFaults: ExerciseFaultContext[];
  analysisInstruction: string;
};

export type Exercise = {
  id: number;
  slug: string;
  name: string;
  category: ExerciseCategory;
  equipment: string[];
  aliases: string[];
  profile: ExerciseProfile;
};
