import { searchExerciseCatalog } from "./exercise-catalog";

const catalog = [
  {
    id: 3,
    name: "Dumbbell Bench Press",
    family: "press",
    aliases: ["flat dumbbell press"],
    mechanics: { laterality: "bilateral" },
  },
  {
    id: 4,
    name: "Back Squat",
    family: "squat",
    aliases: ["barbell squat"],
    mechanics: { laterality: "bilateral" },
  },
];

describe("searchExerciseCatalog", () => {
  it("uses the ranked RPC boundary instead of loading a truncated catalog", async () => {
    const loadCatalog = jest.fn(async () => ({ data: [catalog[0]], error: null }));

    await expect(searchExerciseCatalog("  dumbbell bench  ", loadCatalog)).resolves.toEqual([catalog[0]]);
    expect(loadCatalog).toHaveBeenCalledWith("dumbbell bench", 20);
  });

  it("accepts already-ranked RPC rows and keeps results bounded to twenty", async () => {
    const rows = Array.from({ length: 24 }, (_, index) => ({
      id: index + 1,
      name: `Press variation ${index + 1}`,
      family: "press",
      aliases: ["favorite bench"],
      mechanics: {},
    }));

    const results = await searchExerciseCatalog("favorite bench", async () => ({ data: rows, error: null }));
    expect(results).toHaveLength(20);
    expect(results[0]?.name).toBe("Press variation 1");
  });

  it("returns no results for blank input without loading the catalog", async () => {
    const loadCatalog = jest.fn();
    await expect(searchExerciseCatalog("   ", loadCatalog)).resolves.toEqual([]);
    expect(loadCatalog).not.toHaveBeenCalled();
  });

  it("does not turn stop-word-only input into broad recommendations", async () => {
    const loadCatalog = jest.fn(async () => ({
      data: [catalog[0]],
      error: null,
    }));
    await expect(searchExerciseCatalog("the", loadCatalog)).resolves.toEqual([]);
    expect(loadCatalog).not.toHaveBeenCalled();
  });

  it("rejects malformed catalog rows instead of passing corrupt exercise IDs into analysis", async () => {
    const loadCatalog = jest.fn(async () => ({ data: [{ ...catalog[0], id: null }], error: null }));
    await expect(searchExerciseCatalog("bench", loadCatalog)).rejects.toThrow();
  });

  it("lets the caller continue with custom text when the catalog request fails", async () => {
    const loadCatalog = jest.fn(async () => ({ data: null, error: { message: "offline" } }));
    await expect(searchExerciseCatalog("bench", loadCatalog)).rejects.toThrow("offline");
  });

  it("rejects rows that do not contain every meaningful query token", async () => {
    const loadCatalog = jest.fn(async () => ({
      data: [
        { ...catalog[0], name: "Dumbbell Bench Press" },
        { ...catalog[1], name: "Back Squat" },
      ],
      error: null,
    }));

    await expect(searchExerciseCatalog("dumbbell bench", loadCatalog)).resolves.toEqual([catalog[0]]);
  });

  it("does not trust unrelated matched_terms from a stale RPC response", async () => {
    const staleRow = {
      ...catalog[1],
      matched_terms: ["bench"],
    };

    await expect(searchExerciseCatalog("dumbbell bench", async () => ({
      data: [staleRow],
      error: null,
    }))).resolves.toEqual([]);
  });

  it.each([
    ["dumbells", "Dumbbell Bench Press"],
    ["lat pulldowns", "Wide Grip Cable Lat Pulldown"],
    ["rear delt fly", "Dumbbell Rear Delt Fly"],
    ["one hand row", "One Arm Dumbbell Row"],
    ["smith bench", "Flat Smith Machine Bench Press"],
    ["bulgarian squat", "Rear Foot Elevated Split Squat"],
  ])("keeps ordinary gym wording strict for %s", async (query, name) => {
    const row = { id: 88, name, family: "movement", aliases: [], mechanics: {} };
    await expect(searchExerciseCatalog(query, async () => ({ data: [row], error: null }))).resolves.toEqual([row]);
  });

  it("preserves an RPC rank where the exact alias is ahead of a typo-tolerant row", async () => {
    const exactAlias = { id: 1, name: "Chest Press", family: "press", aliases: ["db bench"], mechanics: {} };
    const fuzzy = { id: 2, name: "Dumbbell Bench Press", family: "press", aliases: [], mechanics: {} };
    await expect(searchExerciseCatalog("db bench", async () => ({ data: [exactAlias, fuzzy], error: null }))).resolves.toEqual([exactAlias, fuzzy]);
  });
});
