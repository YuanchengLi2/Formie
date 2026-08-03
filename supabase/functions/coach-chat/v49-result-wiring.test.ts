import { readFileSync } from "node:fs";
import { resolve } from "node:path";

it("grounds chat in the active v49 result without asking the legacy adapter to transform it", () => {
  const source = readFileSync(resolve(__dirname, "index.ts"), "utf8");
  expect(source).toContain('from("analysis_v49_runs")');
  expect(source).toMatch(/resultPayload\(session,\s*result,\s*v49Run\?\.public_result/);
});
