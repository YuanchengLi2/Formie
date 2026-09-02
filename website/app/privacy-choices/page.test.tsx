import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import PrivacyChoicesPage from "./page";

test("privacy choices gives direct app and external account controls", () => {
  const html = renderToStaticMarkup(<PrivacyChoicesPage />);
  assert.match(html, /Settings &gt; Delete Account/i);
  assert.match(html, /active subscription/i);
  assert.match(html, /delete an analysis/i);
  assert.match(html, /Apple subscription/i);
  assert.match(html, /Sign in with Apple/i);
  assert.match(html, /Withdraw AI processing consent/i);
  assert.match(html, /automatically revokes|encrypted deletion queue/i);
  assert.match(html, /legacy Apple account/i);
  assert.match(html, /href="\/retention"/i);
  assert.match(html, /href="\/support"/i);
});
