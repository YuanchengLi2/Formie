import assert from "node:assert/strict";
import test from "node:test";

import { POST } from "./route";

const validRequest = {
  name: "Jamie",
  email: "jamie@example.com",
  category: "account",
  message: "I need help updating the email on my Formie account.",
  website: "",
};

test("forwards a validated request with only the server-observed client IP", async (context) => {
  const originalFetch = globalThis.fetch;
  const originalUrl = process.env.FORMIE_SUPPORT_FUNCTION_URL;
  const originalToken = process.env.FORMIE_SUPPORT_INTERNAL_TOKEN;
  process.env.FORMIE_SUPPORT_FUNCTION_URL = "https://project.supabase.co/functions/v1/send-support";
  process.env.FORMIE_SUPPORT_INTERNAL_TOKEN = "internal-token";
  context.after(() => {
    globalThis.fetch = originalFetch;
    process.env.FORMIE_SUPPORT_FUNCTION_URL = originalUrl;
    process.env.FORMIE_SUPPORT_INTERNAL_TOKEN = originalToken;
  });

  globalThis.fetch = async (_input, init) => {
    assert.equal(init?.headers && new Headers(init.headers).get("Authorization"), "Bearer internal-token");
    assert.equal(init?.headers && new Headers(init.headers).get("X-Formie-Client-IP"), "198.51.100.8");
    assert.deepEqual(JSON.parse(String(init?.body)), validRequest);
    return Response.json({ submitted: true, requestId: "support-request-id" });
  };

  const response = await POST(new Request("https://useformie.com/api/support", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-vercel-forwarded-for": "198.51.100.8, 10.0.0.1",
    },
    body: JSON.stringify(validRequest),
  }));

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { submitted: true, requestId: "support-request-id" });
});

test("rejects invalid input before calling the support function", async (context) => {
  const originalFetch = globalThis.fetch;
  context.after(() => {
    globalThis.fetch = originalFetch;
  });
  let called = false;
  globalThis.fetch = async () => {
    called = true;
    return Response.json({});
  };

  const response = await POST(new Request("https://useformie.com/api/support", {
    method: "POST",
    body: JSON.stringify({ ...validRequest, message: "Too short" }),
  }));

  assert.equal(response.status, 400);
  assert.equal(called, false);
});
