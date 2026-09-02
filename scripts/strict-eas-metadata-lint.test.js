import assert from "node:assert/strict";
import test from "node:test";

import { injectReviewMetadata, metadataLintErrors } from "./strict-eas-metadata-lint.mjs";

const environment = {
  APP_REVIEW_FIRST_NAME: "Review",
  APP_REVIEW_LAST_NAME: "Contact",
  APP_REVIEW_EMAIL: "review@example.test",
  APP_REVIEW_PHONE: "+1 555 010 0100",
  APP_REVIEW_DEMO_USERNAME: "reviewer@example.test",
  APP_REVIEW_DEMO_PASSWORD: "not-a-real-password",
};

test("injects complete review access without changing source notes", () => {
  const source = { configVersion: 0, apple: { review: { notes: "Reviewer flow" } } };
  const populated = injectReviewMetadata(source, environment);
  assert.deepEqual(populated.apple.review, {
    notes: "Reviewer flow",
    firstName: "Review",
    lastName: "Contact",
    email: "review@example.test",
    phone: "+1 555 010 0100",
    demoUsername: "reviewer@example.test",
    demoPassword: "not-a-real-password",
    demoRequired: true,
  });
  assert.deepEqual(source, { configVersion: 0, apple: { review: { notes: "Reviewer flow" } } });
});

test("fails closed when any secure review input is missing", () => {
  assert.throws(
    () => injectReviewMetadata({ apple: { review: {} } }, { ...environment, APP_REVIEW_PHONE: "" }),
    /APP_REVIEW_PHONE/,
  );
});

test("allows TestFlight-only structural lint without weakening final review mode", () => {
  const source = { configVersion: 0, apple: { review: { notes: "Reviewer flow" } } };
  const populated = injectReviewMetadata(
    source,
    { APP_REVIEW_FIRST_NAME: "", APP_REVIEW_EMAIL: "support@useformie.com", APP_REVIEW_DEMO_USERNAME: "appreview@useformie.com" },
    { mode: "testflight" },
  );
  assert.equal(populated.apple.review.firstName, "TestFlight");
  assert.equal(populated.apple.review.phone, "+1 202 555 0100");
  assert.equal(populated.apple.review.email, "support@useformie.com");
  assert.equal(populated.apple.review.demoUsername, "appreview@useformie.com");
  assert.equal(source.apple.review.firstName, undefined);
  assert.throws(
    () => injectReviewMetadata(source, { APP_REVIEW_EMAIL: "support@useformie.com" }),
    /APP_REVIEW_FIRST_NAME/,
  );
});

test("rejects unknown metadata lint modes", () => {
  assert.throws(() => injectReviewMetadata({ apple: { review: {} } }, environment, { mode: "submission" }), /Unsupported metadata lint mode/);
});

test("treats EAS severity-2 metadata findings as blocking", () => {
  assert.equal(metadataLintErrors(JSON.stringify([{ severity: 1 }, { severity: 2, message: "missing" }])).length, 1);
});
