import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import PrivacyPage from "./page";

test("privacy policy points to the detailed retention policy without a website dashboard", () => {
  const html = renderToStaticMarkup(<PrivacyPage />);
  assert.match(html, /href="\/retention"/);
  assert.doesNotMatch(html, /website (?:subscription )?dashboard/i);
  assert.doesNotMatch(html, /uploads are removed after processing/i);
});
