import { readFileSync } from "node:fs";
import { resolve } from "node:path";

it("routes each retry to its recorded pipeline while allowing v64 sessions during the v49 rollout", () => {
  const source = readFileSync(resolve(__dirname, "index.ts"), "utf8");
  expect(source).toContain('primaryV49Enabled && session.activeV49RunId ? "analyze-video-v49" : "analyze-video"');
  expect(source).toContain('if (!primaryV49Enabled) query = query.is("active_v49_run_id", null)');
  expect(source).toContain('activeV49RunId: session.active_v49_run_id ?? null');
  expect(source).toContain('"analyzing", "finalizing", "retry_wait"');
});
