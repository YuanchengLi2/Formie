export type OnboardingPreviewTab = "what" | "why" | "next";

export const onboardingPreviewFixture = {
  exercise: "Dumbbell bench press",
  issueTitle: "Control the late descent",
  timestamp: "00:07.8",
  score: 78,
  whatHappened: "On reps 7 and 8, both dumbbells descend faster than they did in the opening reps.",
  whyItMatters: "That changes the bottom position of this bench press and makes the last repetitions less repeatable.",
  whatToDo: "Lower both dumbbells for two seconds on every next repetition.",
  successCheck: "The late reps match the opening lowering speed.",
  summary: "Your path stays steady early, then the final two repetitions lose lowering control.",
  strengths: ["Stable setup", "Even press path"],
  cue: "Keep the lowering phase controlled from the first rep to the last.",
  muscles: ["Chest", "Triceps", "Front shoulders"],
} as const;
