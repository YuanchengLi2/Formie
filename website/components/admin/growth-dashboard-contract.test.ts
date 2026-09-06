import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("growth rendering accepts the deployed attempt-count field while the reporting contract migrates", () => {
  const source = readFileSync(resolve(__dirname, "./growth-dashboard.tsx"), "utf8");
  assert.match(source, /attempts:row\.attempts\?\?row\.users/g);
});
