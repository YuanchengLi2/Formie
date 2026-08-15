import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import TermsPage from "./page";

test("terms direct subscription management to the native app", () => {
  const html = renderToStaticMarkup(<TermsPage />);
  assert.match(html, /manage (?:your )?subscription in (?:the )?Formie app/i);
  assert.doesNotMatch(html, /website dashboard|dashboard access/i);
  assert.doesNotMatch(html, /\bdraft\b|finalized before public release/i);
  assert.match(html, /automatically renews each month until cancelled/i);
  assert.match(html, /charged to (?:your )?Apple ID/i);
  assert.match(html, /does not cancel (?:your )?Apple subscription/i);
  assert.match(html, /https:\/\/www\.apple\.com\/legal\/internet-services\/itunes\/dev\/stdeula\//);
});
