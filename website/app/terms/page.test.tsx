import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import TermsPage from "./page";

test("terms direct subscription management to the native app", () => {
  const html = renderToStaticMarkup(<TermsPage />);
  assert.match(html, /manage (?:your )?subscription in (?:the )?Formie app/i);
  assert.doesNotMatch(html, /website dashboard|dashboard access/i);
});
