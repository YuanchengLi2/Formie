import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("structured muscle focus migration", () => {
  it("keeps legacy arrays readable while allowing structured front/back targets", () => {
    const sql = readFileSync(
      resolve(__dirname, "../../../supabase/migrations/202607260045_structured_muscle_focus.sql"),
      "utf8",
    );

    expect(sql).toMatch(/drop constraint if exists analysis_results_muscle_focus_array/i);
    expect(sql).toMatch(/jsonb_typeof\(muscle_focus\)\s+in\s+\('array',\s*'object'\)/i);
  });
});
