import assert from "node:assert/strict";
import test from "node:test";

import { buildContentSecurityPolicy, productionSecurityHeaders } from "./security-headers";

test("builds a nonce-bound CSP without wildcard sources", () => {
  const policy = buildContentSecurityPolicy("nonce-value", true, "https://project.supabase.co");
  assert.match(policy, /script-src 'self' 'nonce-nonce-value' 'strict-dynamic'/);
  assert.match(policy, /frame-ancestors 'none'/);
  assert.match(policy, /object-src 'none'/);
  assert.doesNotMatch(policy, /\*/);
  assert.match(policy, /connect-src 'self' https:\/\/project\.supabase\.co wss:\/\/project\.supabase\.co/);
});

test("sets transport, framing, MIME, referrer, and permissions protections", () => {
  const headers = Object.fromEntries(productionSecurityHeaders);
  assert.match(headers["Strict-Transport-Security"], /max-age=63072000/);
  assert.equal(headers["X-Frame-Options"], "DENY");
  assert.equal(headers["X-Content-Type-Options"], "nosniff");
  assert.equal(headers["Referrer-Policy"], "strict-origin-when-cross-origin");
  assert.match(headers["Permissions-Policy"], /camera=\(\)/);
});
