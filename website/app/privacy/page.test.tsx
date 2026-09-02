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

test("privacy policy matches Apple's generative-AI consent requirements", () => {
  const html = renderToStaticMarkup(<PrivacyPage />);
  assert.match(html, /before (?:Formie )?(?:uploads|sends|shares)/i);
  assert.match(html, /exercise video/i);
  assert.match(html, /exercise declaration/i);
  assert.match(html, /relevant profile/i);
  assert.match(html, /paid Google Gemini API/i);
  assert.match(html, /affirmative|agree and analyze/i);
  assert.match(html, /equal protection|contractual protections/i);
  assert.match(html, /withdraw consent/i);
});

test("privacy policy uses the canonical support identity", () => {
  const html = renderToStaticMarkup(<PrivacyPage />);
  assert.match(html, /support@useformie\.com/i);
  assert.doesNotMatch(html, /yuanchengli612@gmail\.com/i);
});

test("privacy policy does not present Coach conversations as a current 1.0 feature", () => {
  const html = renderToStaticMarkup(<PrivacyPage />);
  assert.match(html, /legacy coaching conversations/i);
  assert.match(html, /Coach Preview does not let users create new conversations/i);
});
