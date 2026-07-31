import { searchExerciseCatalog } from "./exercise-catalog";

describe("searchExerciseCatalog", () => {
  it("trims the query, uses the bounded RPC, and validates results", async () => {
    const rpc = jest.fn(async () => ({
      data: [{
        id: 3,
        name: "Dumbbell Bench Press",
        family: "press",
        aliases: ["flat dumbbell press"],
        mechanics: { laterality: "bilateral" },
      }],
      error: null,
    }));

    await expect(searchExerciseCatalog("  dumbbell bench  ", rpc)).resolves.toEqual([{
      id: 3,
      name: "Dumbbell Bench Press",
      family: "press",
      aliases: ["flat dumbbell press"],
      mechanics: { laterality: "bilateral" },
    }]);
    expect(rpc).toHaveBeenCalledWith("search_exercise_variants", {
      p_query: "dumbbell bench",
      p_limit: 12,
    });
  });

  it("returns no results for blank input without calling the server", async () => {
    const rpc = jest.fn();
    await expect(searchExerciseCatalog("   ", rpc)).resolves.toEqual([]);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("lets the caller fall back to custom text when search fails", async () => {
    const rpc = jest.fn(async () => ({ data: null, error: { message: "offline" } }));
    await expect(searchExerciseCatalog("bench", rpc)).rejects.toThrow("offline");
  });
});
