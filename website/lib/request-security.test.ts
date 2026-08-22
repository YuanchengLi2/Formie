import assert from "node:assert/strict";
import test from "node:test";

import { enforceSameOrigin, readBoundedBody } from "./request-security";

test("accepts only approved same-origin state-changing requests", () => {
  assert.equal(enforceSameOrigin(new Request("https://useformie.com/api/support", { method: "POST", headers: { Origin: "https://useformie.com" } })), null);
  assert.equal(enforceSameOrigin(new Request("https://useformie.com/api/support", { method: "POST", headers: { Origin: "https://evil.example" } }))?.status, 403);
  assert.equal(enforceSameOrigin(new Request("https://useformie.com/api/support", { method: "POST" }))?.status, 403);
});

test("reads JSON within the byte limit and rejects oversized bodies", async () => {
  const parsed = await readBoundedBody(new Request("https://useformie.com/api/support", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ok: true }),
  }), 32);
  assert.deepEqual(parsed, { ok: true });
  await assert.rejects(() => readBoundedBody(new Request("https://useformie.com/api/support", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "x".repeat(33),
  }), 32), /PAYLOAD_TOO_LARGE/);
});
