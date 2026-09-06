import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

const pageUrl = new URL("./login/page.tsx", import.meta.url);

test("login directory routes customers, creators, and founders to the correct access points", async () => {
  assert.equal(existsSync(pageUrl), true, "the /login directory page must exist");
  const { default: LoginDirectoryPage } = await import(pageUrl.href);
  const html = renderToStaticMarkup(<LoginDirectoryPage />);

  assert.match(html, />Formie app</i);
  assert.match(html, /customers sign in inside the app/i);
  assert.match(html, /href="\/creators\/login"[^>]*>Creator sign in</i);
  assert.match(html, /href="\/admin\/login"[^>]*>Founder sign in</i);
  assert.doesNotMatch(html, /password\s*[:=]|token\s*[:=]|secret\s*[:=]/i);
});
