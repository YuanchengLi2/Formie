import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import { AdminLoginForm } from "./admin-login-form";

test("renders a password-safe founder login without embedded credentials", () => {
  const html = renderToStaticMarkup(<AdminLoginForm />);

  assert.match(html, /Founder access/i);
  assert.match(html, /type="email"/i);
  assert.match(html, /type="password"/i);
  assert.match(html, /Sign in/i);
  const passwordInput = html.match(/<input[^>]*type="password"[^>]*>/i)?.[0] ?? "";
  assert.doesNotMatch(passwordInput, /value=/i);
});
