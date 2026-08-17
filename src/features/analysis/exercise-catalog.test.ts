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
  it("loads the canonical table and ranks matching names locally without the trigram RPC", async () => {
    const loadCatalog = jest.fn(async () => ({ data: catalog, error: null }));

    await expect(searchExerciseCatalog("  dumbbell bench  ", loadCatalog)).resolves.toEqual([catalog[0]]);
    expect(loadCatalog).toHaveBeenCalledTimes(1);
  });

  it("matches canonical aliases and keeps results bounded to twelve", async () => {
    const rows = Array.from({ length: 20 }, (_, index) => ({
      id: index + 1,
      name: `Press variation ${index + 1}`,
      family: "press",
      aliases: index === 15 ? ["favorite bench"] : [],
      mechanics: {},
    }));

    const results = await searchExerciseCatalog("favorite bench", async () => ({ data: rows, error: null }));
    expect(results).toHaveLength(1);
    expect(results[0]?.name).toBe("Press variation 16");
  });

  it("returns no results for blank input without loading the catalog", async () => {
    const loadCatalog = jest.fn();
    await expect(searchExerciseCatalog("   ", loadCatalog)).resolves.toEqual([]);
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
});
