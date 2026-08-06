import assert from "node:assert/strict";
import test from "node:test";
import { sanitizedNext } from "./callback-next";

test("website auth callback permits only the internal subscription portal", () => {
  assert.equal(sanitizedNext("/manage-subscription"), "/manage-subscription");
  assert.equal(sanitizedNext("https://attacker.example"), "/manage-subscription");
  assert.equal(sanitizedNext("/pricing"), "/manage-subscription");
});
