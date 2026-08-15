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

test("privacy policy is presented as the current public policy", () => {
  const html = renderToStaticMarkup(<PrivacyPage />);
  assert.match(html, /This policy explains how Formie handles information/i);
  assert.doesNotMatch(html, /\bdraft\b/i);
  assert.doesNotMatch(html, /finalized before public release/i);
});

test("privacy policy discloses the shipped data and processor boundaries", () => {
  const html = renderToStaticMarkup(<PrivacyPage />);
  for (const subject of [
    /photos? or videos?|exercise recordings/i,
    /body|head|hand|motion/i,
    /Google Gemini/i,
    /purchase|entitlement/i,
    /product interaction|analytics/i,
    /diagnostic/i,
    /delete (?:your )?account/i,
    /RevenueCat/i,
    /Supabase/i,
  ]) assert.match(html, subject);
});
