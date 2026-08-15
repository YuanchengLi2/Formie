const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const STANDARD_APPLE_EULA_URL = "https://www.apple.com/legal/internet-services/itunes/dev/stdeula/";
const PRODUCTION_URLS = {
  privacyPolicyUrl: "https://useformie.com/privacy",
  supportUrl: "https://useformie.com/support",
  marketingUrl: "https://useformie.com",
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
  assert.doesNotMatch(JSON.stringify(config), /\bdraft\b|finalized before public release|lorem ipsum/i);
  assert.match(config.apple.review.notes, /Restore Purchases/);
  assert.match(config.apple.review.notes, /Settings > Delete Account/);
  assert.match(config.apple.review.notes, /Sign in with Apple/);
  assert.match(config.apple.review.notes, /https:\/\/useformie\.com\/privacy-choices/);
});
