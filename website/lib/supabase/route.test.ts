import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest, NextResponse } from "next/server";

import { createRouteCookieAdapter } from "./route";

test("OAuth route cookies are written onto the exact redirect response", () => {
  const request = new NextRequest("https://useformie.com/auth/callback?code=one", {
    headers: { cookie: "sb-existing=verifier" },
  });
  const response = NextResponse.redirect("https://useformie.com/manage-subscription");
  const adapter = createRouteCookieAdapter(request, response);

  assert.deepEqual(adapter.getAll(), [{ name: "sb-existing", value: "verifier" }]);
  adapter.setAll([{ name: "sb-session", value: "authenticated", options: { httpOnly: true, sameSite: "lax", path: "/" } }]);

  assert.equal(response.cookies.get("sb-session")?.value, "authenticated");
  assert.match(response.headers.get("set-cookie") ?? "", /sb-session=authenticated/);
});
