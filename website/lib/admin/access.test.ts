import assert from "node:assert/strict";
import test from "node:test";

import { isAdminEmail } from "./access";

test("only the configured founder email is an admin", () => {
  const configured = "yuanchengli612@gmail.com";

  assert.equal(isAdminEmail("yuanchengli612@gmail.com", configured), true);
  assert.equal(isAdminEmail(" YuanchengLi612@Gmail.com ", configured), true);
  assert.equal(isAdminEmail("someone@example.com", configured), false);
  assert.equal(isAdminEmail(null, configured), false);
});

test("admin access fails closed when the allowlist is missing", () => {
  assert.equal(isAdminEmail("yuanchengli612@gmail.com", undefined), false);
  assert.equal(isAdminEmail("yuanchengli612@gmail.com", ""), false);
});
