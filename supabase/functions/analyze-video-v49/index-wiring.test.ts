import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = () => readFileSync(resolve(__dirname, "index.ts"), "utf8");

it("wires one video problem-finder call followed by one text-only writer call", () => {
  const code = source();
  expect(code).toContain("V49_ANALYST_MODEL");
  expect(code).toContain("PROBLEM_FINDER_SCHEMA");
  expect(code).toContain('"problem_finder"');
  expect(code).toContain("preserveSchemaBounds: true");
  expect(code).toContain("V49_WRITER_MODEL");
  expect(code).toContain("COACHING_WRITER_SCHEMA");
  expect(code).toContain("claim_analysis_v49_stage");
  expect(code).toContain("commit_analysis_v49_result");
  expect(code).not.toMatch(/PROBLEM_ADJUDICATOR_SCHEMA|problem_scout_a|problem_scout_b|problem_adjudicator/);
  expect(code).not.toMatch(/buildBoundaryFree|enforceCorrectionCoaching|declarationOnlyAnalysis|analysis_draft|commit_analysis_result_v2/);
});

it("does not set a deterministic analyst temperature override", () => {
  expect(source()).not.toMatch(/temperature\s*:/);
});

it("sends short retained videos inline without the Gemini Files ingestion path", () => {
  const code = source();
  expect(code).toContain("prepareV49InlineVideo");
  expect(code).toContain("videoSha256");
  expect(code).not.toMatch(/createGeminiFilesClient|uploadVideo|getFile|deleteFile/);
});
