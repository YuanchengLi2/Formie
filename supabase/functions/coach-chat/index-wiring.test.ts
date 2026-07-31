import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("coach chat production wiring", () => {
  it("uses the session-level refreshed video cache and atomic exchange RPC", () => {
    const source = readFileSync(resolve(__dirname, "index.ts"), "utf8");
    expect(source).toContain("ensureCoachVideoFile");
    expect(source).toContain("getFile: (name) => files.getFile(name)");
    expect(source).toContain('.from("analysis_sessions").update');
    expect(source).toContain('.rpc("append_coach_exchange"');
    expect(source).toContain("exchange_key");
    expect(source).toContain("grounding");
    expect(source).toContain("coach.locateQuestion");
    expect(source).toContain("coach.answerQuestion");
    expect(source).not.toMatch(/from\("coach_threads"\)\.update\(\{ gemini_file_name/);
  });
});
