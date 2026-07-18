import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("saved-video reanalysis migration", () => {
  it("does not reference worker tables removed by the Gemini-only migration", () => {
    const migrationsDirectory = resolve(__dirname, "../../../supabase/migrations");
    const resetMigration = readdirSync(migrationsDirectory)
      .sort()
      .reverse()
      .map((file) => readFileSync(resolve(migrationsDirectory, file), "utf8"))
      .find((sql) => sql.includes("create or replace function public.reset_analysis_for_reanalysis"));

    expect(resetMigration).toBeDefined();
    expect(resetMigration).not.toContain("public.pose_artifacts");
    expect(resetMigration).not.toContain("public.analysis_jobs");
    expect(resetMigration).toContain("delete from public.analysis_results");
  });
});
