import assert from "node:assert/strict";
import test from "node:test";

import { consumeAdminLoginAttempt, resetAdminLoginRateLimitForTests } from "./login-rate-limit";

test("bounds repeated founder login attempts within a rolling window", () => {
  resetAdminLoginRateLimitForTests();
  for (let index = 0; index < 8; index += 1) assert.equal(consumeAdminLoginAttempt("198.51.100.2", index), true);
  assert.equal(consumeAdminLoginAttempt("198.51.100.2", 9), false);
  assert.equal(consumeAdminLoginAttempt("198.51.100.2", 15 * 60 * 1_000 + 1), true);
});
