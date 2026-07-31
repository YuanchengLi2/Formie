import {
  anatomyHighlightForName,
  fittedAnatomyScale,
  isSurfaceAnatomyMuscle,
  regionMatchesAnatomyName,
} from "./anatomy-region-mapping";

describe("anatomy region mapping", () => {
  it.each([
    ["lats", "Latissimus Dorsi Muscle"],
    ["shoulders", "Acromial Part Of Deltoid Muscle"],
    ["upper_back", "Rhomboid Major Muscle"],
    ["elbows", "Anconeus"],
    ["torso", "Rectus Abdominis Muscle"],
    ["hamstrings", "Long Head Of Biceps Femoris"],
    ["ankles", "Tibialis Anterior Muscle"],
  ] as const)("maps %s to named Z-Anatomy muscle meshes", (region, name) => {
    expect(regionMatchesAnatomyName(region, name)).toBe(true);
  });

  it("does not confuse a path target with an unrelated body region", () => {
    expect(regionMatchesAnatomyName("lats", "Acromial Part Of Deltoid Muscle")).toBe(false);
  });

  it("distinguishes anterior, lateral, and posterior deltoid mesh parts", () => {
    expect(regionMatchesAnatomyName("front_shoulders", "Clavicular Part Of Deltoid Muscle")).toBe(true);
    expect(regionMatchesAnatomyName("front_shoulders", "Scapular Spinal Part Of Deltoid Muscle")).toBe(false);
    expect(regionMatchesAnatomyName("rear_shoulders", "Scapular Spinal Part Of Deltoid Muscle")).toBe(true);
    expect(regionMatchesAnatomyName("rear_shoulders", "Clavicular Part Of Deltoid Muscle")).toBe(false);
  });

  it("does not color rotator-cuff and teres meshes for a visible shoulder-region issue", () => {
    expect(regionMatchesAnatomyName("shoulders", "Supraspinatus Muscle")).toBe(false);
    expect(regionMatchesAnatomyName("shoulders", "Teres Major Muscle")).toBe(false);
    expect(regionMatchesAnatomyName("upper_back", "Teres Major Muscle")).toBe(false);
  });

  it("does not color whole limb muscles for a joint-only issue region", () => {
    expect(regionMatchesAnatomyName("elbows", "Biceps Brachii Muscle")).toBe(false);
    expect(regionMatchesAnatomyName("elbows", "Triceps Brachii Muscle")).toBe(false);
    expect(regionMatchesAnatomyName("knees", "Rectus Femoris Muscle")).toBe(false);
    expect(regionMatchesAnatomyName("knees", "Gastrocnemius Muscle")).toBe(false);
    expect(regionMatchesAnatomyName("hips", "Gluteus Maximus Muscle")).toBe(false);
  });

  it("shows observed issue coloring over intended-target coloring on the same mesh", () => {
    expect(anatomyHighlightForName(
      "Latissimus Dorsi Muscle",
      true,
      ["lats"],
      ["lats"],
    )).toBe("issue");
  });

  it("keeps non-muscle anatomy neutral", () => {
    expect(anatomyHighlightForName(
      "Left Scapula",
      false,
      ["upper_back"],
      ["shoulders"],
    )).toBe("bone");
  });

  it("preserves the fitted model size while zooming and resetting", () => {
    expect(fittedAnatomyScale(1.08, 1.5)).toBeCloseTo(1.62);
    expect(fittedAnatomyScale(1.08, 1)).toBeCloseTo(1.08);
  });

  it.each([
    "Clavicular Head Of Pectoralis Major Muscle",
    "Latissimus Dorsi Muscle",
    "Long Head Of Biceps Brachii",
    "Rectus Abdominis Muscle",
    "Gluteus Maximus Muscle",
    "Vastus Lateralis Muscle",
    "Medial Head Of Gastrocnemius",
  ])("keeps the visible outer muscle shell: %s", (name) => {
    expect(isSurfaceAnatomyMuscle(name)).toBe(true);
  });

  it.each([
    "Inferior Rectus Muscle",
    "Common Tendinous Ring",
    "Diaphragm",
    "Pectoralis Minor Muscle",
    "Obturator Internus",
    "Multifidus Lumborum Muscle",
  ])("removes deep and internal anatomy from the fitness model: %s", (name) => {
    expect(isSurfaceAnatomyMuscle(name)).toBe(false);
  });
});
