import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  auditAppStorePolicy,
  auditIosReleaseSurfaces,
  auditScreenshotReleasePlan,
} from "./app-store-policy-audit.mjs";

test("repository App Store policy controls remain wired", () => {
  assert.deepEqual(auditAppStorePolicy(), []);
});

test("policy audit covers legacy Apple account-deletion events", () => {
  const audit = readFileSync(new URL("./app-store-policy-audit.mjs", import.meta.url), "utf8");
  assert.match(audit, /resolve_apple_identity_user_id/);
  assert.match(audit, /Apple server account-deletion events do not fall back to legacy identity resolution/);
});

test("iPhone-only release surfaces require iPad compatibility acceptance and exclude Mac and Vision", () => {
  assert.deepEqual(
    auditIosReleaseSurfaces(
      { ios: { supportsTablet: false } },
      {
        iphoneOnly: true,
        appStoreAvailability: { appleSiliconMac: false, appleVisionPro: false },
        physicalAcceptance: ["physical_iphone", "ipad_iphone_compatibility"],
      },
    ),
    [],
  );

  assert.deepEqual(
    auditIosReleaseSurfaces(
      { ios: { supportsTablet: true } },
      {
        iphoneOnly: true,
        appStoreAvailability: { appleSiliconMac: true, appleVisionPro: true },
        physicalAcceptance: ["physical_iphone"],
      },
    ),
    [
      "Expo iOS configuration must remain iPhone-only for Formie 1.0",
      "Apple silicon Mac availability must be disabled for Formie 1.0",
      "Apple Vision Pro availability must be disabled for Formie 1.0",
      "iPad iPhone-compatibility acceptance is missing",
    ],
  );
});

test("screenshot release plan fixes the angled-benefits image first and preserves chronological order at 6.9-inch size", () => {
  const expectedOrder = [
    "01-benefits-overview.png",
    "02-record-a-set.png",
    "03-analysis-in-progress.png",
    "04-evidence-linked-correction.png",
    "05-progress-and-next-set.png",
  ];

  assert.deepEqual(
    auditScreenshotReleasePlan({
      screenshotCanvas: { width: 1290, height: 2796 },
      firstScreenshotComposition: "angled_phone_benefits",
      screenshotOrder: expectedOrder,
    }),
    [],
  );

  assert.deepEqual(
    auditScreenshotReleasePlan({
      screenshotCanvas: { width: 1179, height: 2556 },
      firstScreenshotComposition: "dashboard",
      screenshotOrder: [...expectedOrder].reverse(),
    }),
    [
      "Final 6.9-inch screenshots must use a 1290x2796 canvas",
      "The leftmost screenshot must be the angled-phone benefits composition",
      "Final screenshots are not in the approved benefits-to-next-set narrative order",
    ],
  );
});

test("TestFlight workflow records signed-archive and Apple processing evidence", () => {
  const workflow = readFileSync(new URL("../.github/workflows/testflight-local-ios.yml", import.meta.url), "utf8");
  assert.match(workflow, /node-version:\s*22/, "CI must satisfy the website Supabase Node 22 engine requirement");
  for (const required of [
    "NSMicrophoneUsageDescription must not be present",
    "com.apple.developer.applesignin",
    "PrivacyInfo.xcprivacy",
    "codesign --verify --deep --strict",
    "archive_sha256",
    "submit:list --platform ios --limit 1 --json",
    "submit:status --platform ios --profile production --json",
    "processingState !== 'VALID'",
    "node scripts/strict-eas-metadata-lint.mjs",
    "APP_REVIEW_DEMO_PASSWORD",
    "App Store Review submission: never performed by this workflow",
  ]) {
    assert.match(workflow, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.doesNotMatch(workflow, /\$\{RELEASE_COMMIT,,\}/, "macOS runner Bash must not use Bash 4 lowercase expansion");
  assert.match(workflow, /tr '\[:upper:\]' '\[:lower:\]'/);
  assert.doesNotMatch(workflow, /eas\s+submit[^\n]+app.?review/i);
});
