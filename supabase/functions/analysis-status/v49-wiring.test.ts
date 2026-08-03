import { readFileSync } from "node:fs";
import { resolve } from "node:path";

it("loads only the active v49 run result and passes it through the v49 branch", () => {
  const source = readFileSync(resolve(__dirname, "index.ts"), "utf8");
  expect(source).toContain("active_v49_run_id");
  expect(source).toContain('from("analysis_v49_runs")');
  expect(source).toMatch(/resultPayload\(session,\s*result,\s*v49Run\?\.public_result/);
});
