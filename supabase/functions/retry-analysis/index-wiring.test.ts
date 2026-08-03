import { readFileSync } from "node:fs";
import { resolve } from "node:path";

it("routes retries to whichever primary pipeline is enabled", () => {
  const source = readFileSync(resolve(__dirname, "index.ts"), "utf8");
  expect(source).toContain('primaryV49Enabled ? "analyze-video-v49" : "analyze-video"');
  expect(source).toContain('query.is("active_v49_run_id", null)');
  expect(source).toContain('"analyzing", "finalizing", "retry_wait"');
});
