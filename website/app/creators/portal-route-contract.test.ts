import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("creator callbacks use the validated public origin", () => {
  const source = readFileSync(resolve(__dirname, "./auth/route.ts"), "utf8");
  assert.match(source, /publicRequestOrigin\(request\)/);
  assert.match(source, /"Cache-Control": "no-store"/);
  assert.doesNotMatch(source, /safeNext\([\s\S]{0,100}, request\.url\)/);
});

test("creator statements paginate the complete owned ledger and fail explicitly at the safety bound", () => {
  const source = readFileSync(resolve(__dirname, "./earnings/statement/route.ts"), "utf8");
  assert.match(source, /\.eq\("creator_id", creatorId\)/);
  assert.match(source, /count: "exact"/);
  assert.match(source, /\.range\(offset,/);
  assert.match(source, /\.from\("creator_payouts"\)/);
  assert.match(source, /paidAtByPayout/);
  assert.doesNotMatch(source, /created_at,paid_at,creator_payout_items/);
  assert.match(source, /rows\.length !== \(count \?\? 0\)/);
  assert.match(source, /response\([\s\S]{0,160}, 413\)/);
  assert.match(source, /CreatorAccessError/);
  assert.match(source, /response\("Statement is temporarily unavailable", 503\)/);
  assert.doesNotMatch(source, /\.limit\(5000\)/);
});
