import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

it("has no runtime import path to an old analyzer, sanitizer, or historical adapter", () => {
  const directory = resolve(__dirname);
  const runtime = readdirSync(directory).filter((name) => name.endsWith(".ts") && !name.endsWith(".test.ts"));
  const source = runtime.map((name) => readFileSync(resolve(directory, name), "utf8")).join("\n");
  expect(source).not.toMatch(/boundary-free-analysis|coaching-contract|legacy-result-adapter|whole-video-runner|stage-execution|\.\.\/analyze-video\//);
});
