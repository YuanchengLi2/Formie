import assert from "node:assert/strict";
import test from "node:test";

import { enforceSameOrigin, publicRequestOrigin, readBoundedBody } from "./request-security";

test("accepts only approved same-origin state-changing requests", () => {
  assert.equal(enforceSameOrigin(new Request("https://useformie.com/api/support", { method: "POST", headers: { Origin: "https://useformie.com" } })), null);
  assert.equal(enforceSameOrigin(new Request("http://127.0.0.1:3100/api/support", { method: "POST", headers: { Origin: "http://127.0.0.1:3100" } })), null);
  const proxiedLocalRequest = new Request("http://localhost:3100/api/support", { method: "POST", headers: { Host: "127.0.0.1:3100", Origin: "http://127.0.0.1:3100" } });
  assert.equal(enforceSameOrigin(proxiedLocalRequest), null);
  assert.equal(publicRequestOrigin(proxiedLocalRequest), "http://127.0.0.1:3100");
  assert.equal(enforceSameOrigin(new Request("http://127.0.0.1:3100/api/support", { method: "POST", headers: { Origin: "http://localhost:3100" } }))?.status, 403);
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
