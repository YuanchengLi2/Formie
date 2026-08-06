import assert from "node:assert/strict";
import test from "node:test";

import { beginWebsiteOAuth } from "./oauth-redirect";

function client(result: { data: { url: string | null }; error: Error | null }) {
  const calls: unknown[] = [];
  return {
    calls,
    value: {
      auth: {
        signInWithOAuth: async (options: unknown) => {
          calls.push(options);
          return result;
        },
      },
    },
  };
}

test("returns an explicit Apple authorization URL without SDK navigation", async () => {
  const fake = client({ data: { url: "https://appleid.apple.com/auth/authorize?state=abc" }, error: null });

  const url = await beginWebsiteOAuth(fake.value, "apple", "https://useformie.com");

  assert.equal(url, "https://appleid.apple.com/auth/authorize?state=abc");
  assert.deepEqual(fake.calls, [{
    provider: "apple",
    options: {
      redirectTo: "https://useformie.com/auth/callback?next=/manage-subscription",
      skipBrowserRedirect: true,
    },
  }]);
});

test("rejects provider failures, missing URLs, and unsafe URLs", async () => {
  await assert.rejects(() => beginWebsiteOAuth(client({ data: { url: null }, error: new Error("provider failed") }).value, "google", "https://useformie.com"), /provider failed/);
  await assert.rejects(() => beginWebsiteOAuth(client({ data: { url: null }, error: null }).value, "apple", "https://useformie.com"), /authorization URL/i);
  await assert.rejects(() => beginWebsiteOAuth(client({ data: { url: "javascript:alert(1)" }, error: null }).value, "apple", "https://useformie.com"), /authorization URL/i);
});
