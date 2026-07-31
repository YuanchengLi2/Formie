import {
  buildMovementLocalizationPrompt,
  movementLocalizationAnchor,
  parseMovementLocalization,
} from "./movement-localization";

describe("movement localization", () => {
  it("preserves ordered repetition windows from the dedicated temporal pass", () => {
    const localization = parseMovementLocalization({
      outcome: "movement_found",
      activeSetStartMs: 400,
      activeSetEndMs: 3_350,
      repetitions: [
        { startMs: 400, peakMs: 600, endMs: 920, observation: "The dumbbell rises and returns." },
        { startMs: 1_000, peakMs: 1_500, endMs: 1_850, observation: "The elbow bends and straightens." },
        { startMs: 2_400, peakMs: 2_850, endMs: 3_350, observation: "The dumbbell repeats the same path." },
      ],
      movementEvidence: ["Three repeated dumbbell paths are visible."],
    }, 5_169);

    expect(localization.repetitions).toHaveLength(3);
    expect(localization).toMatchObject({
      outcome: "movement_found",
      activeSetStartMs: 400,
      activeSetEndMs: 3_350,
    });
    expect(movementLocalizationAnchor(localization)).toContain("400-920 ms");
    expect(movementLocalizationAnchor(localization)).toContain("2400-3350 ms");
  });

  it("rejects a no-movement verdict that simultaneously reports repetition windows", () => {
    expect(() => parseMovementLocalization({
      outcome: "no_movement",
      activeSetStartMs: null,
      activeSetEndMs: null,
      repetitions: [
        { startMs: 400, peakMs: 600, endMs: 920, observation: "A repetition is visible." },
      ],
      movementEvidence: [],
    }, 5_169)).toThrow(/no.movement.*repetition/i);
  });

  it("asks only for temporal movement localization, not coaching or fault generation", () => {
    const prompt = buildMovementLocalizationPrompt(5_169, "Incline Row", 3);
    expect(prompt).toContain("locate the active exercise movement");
    expect(prompt).toMatch(/declared 3 repetitions/i);
    expect(prompt).toMatch(/watch the complete 5169 ms recording/i);
    expect(prompt).not.toMatch(/correction|score|coaching/i);
  });
});
