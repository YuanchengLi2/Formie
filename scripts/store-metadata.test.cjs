const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const STANDARD_APPLE_EULA_URL = "https://www.apple.com/legal/internet-services/itunes/dev/stdeula/";
const PRODUCTION_URLS = {
  privacyPolicyUrl: "https://useformie.com/privacy",
  supportUrl: "https://useformie.com/support",
  marketingUrl: "https://useformie.com",
  privacyChoicesUrl: "https://useformie.com/privacy-choices",
};

function loadConfig() {
  const configPath = path.join(__dirname, "..", "store.config.json");
  return JSON.parse(fs.readFileSync(configPath, "utf8"));
}

test("subscription App Store description links to Apple's standard EULA", () => {
  const config = loadConfig();
  const description = config.apple.info["en-US"].description;

  assert.match(description, /Terms of Use \(EULA\):/);
  assert.ok(description.includes(STANDARD_APPLE_EULA_URL));
  assert.doesNotThrow(() => new URL(STANDARD_APPLE_EULA_URL));
});

test("App Store metadata uses production URLs and gives reviewers complete navigation", () => {
  const config = loadConfig();
  const info = config.apple.info["en-US"];

  assert.equal(info.privacyPolicyUrl, PRODUCTION_URLS.privacyPolicyUrl);
  assert.equal(info.supportUrl, PRODUCTION_URLS.supportUrl);
  assert.equal(info.marketingUrl, PRODUCTION_URLS.marketingUrl);
  assert.equal(info.privacyChoicesUrl, PRODUCTION_URLS.privacyChoicesUrl);
  assert.doesNotMatch(JSON.stringify(config), /\bdraft\b|finalized before public release|lorem ipsum/i);
  assert.match(config.apple.review.notes, /Restore Purchases/);
  assert.match(config.apple.review.notes, /Settings > Delete Account/);
  assert.match(config.apple.review.notes, /Sign in with Apple/);
  assert.match(config.apple.review.notes, /email\/password/i);
  assert.match(config.apple.review.notes, /Agree and analyze/);
  assert.match(config.apple.review.notes, /YouTube Data API/);
  assert.match(config.apple.review.notes, /Coach Preview.*nonfunctional/is);
  assert.doesNotMatch(config.apple.review.notes, /Apple is the only|credentials (?:are )?above/i);
  assert.match(config.apple.review.notes, /https:\/\/useformie\.com\/privacy-choices/);
});

test("release remains manual and age/privacy metadata matches the adult-only service", () => {
  const config = loadConfig();
  assert.equal(config.apple.release.automaticRelease, false);
  assert.equal(config.apple.advisory.ageRatingOverride, "SEVENTEEN_PLUS");
  assert.equal(config.apple.advisory.ageRatingOverrideV2, "EIGHTEEN_PLUS");
  assert.equal(config.apple.advisory.developerAgeRatingInfoUrl, "https://useformie.com/terms");
  assert.equal(config.apple.advisory.healthOrWellnessTopics, true);
  assert.equal(config.apple.advisory.medicalOrTreatmentInformation, "NONE");
  assert.doesNotMatch(JSON.stringify(config), /reviewer.{0,20}(?:password|secret)\s*[:=]/i);
});
