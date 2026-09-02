import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { auditSubmissionAssets } from "./app-store-submission-assets-audit.mjs";

const screenshotOrder = [
  "01-benefits-overview.png",
  "02-record-a-set.png",
  "03-analysis-in-progress.png",
  "04-evidence-linked-correction.png",
  "05-progress-and-next-set.png",
];

function png(width, height, colorType = 2) {
  const bytes = Buffer.alloc(45);
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(bytes, 0);
  bytes.writeUInt32BE(13, 8);
  bytes.write("IHDR", 12, "ascii");
  bytes.writeUInt32BE(width, 16);
  bytes.writeUInt32BE(height, 20);
  bytes[24] = 8;
  bytes[25] = colorType;
  bytes.writeUInt32BE(0, 29);
  bytes.writeUInt32BE(0, 33);
  bytes.write("IEND", 37, "ascii");
  bytes.writeUInt32BE(0, 41);
  return bytes;
}

function createFixture() {
  const root = mkdtempSync(join(tmpdir(), "formie-submission-assets-"));
  mkdirSync(join(root, "docs", "app-store"), { recursive: true });
  mkdirSync(join(root, "assets", "app-store", "ios", "6.9", "final"), { recursive: true });
  mkdirSync(join(root, "assets", "app-store", "subscriptions"), { recursive: true });
  writeFileSync(
    join(root, "docs", "app-store", "1.0-release-gates.json"),
    JSON.stringify({
      screenshotCanvas: { width: 1290, height: 2796 },
      screenshotOrder,
      subscriptionReviewScreenshot: {
        path: "assets/app-store/subscriptions/formie-monthly-review.png",
        width: 1290,
        height: 2796,
      },
    }),
  );
  for (const name of screenshotOrder) {
    writeFileSync(join(root, "assets", "app-store", "ios", "6.9", "final", name), png(1290, 2796));
  }
  writeFileSync(
    join(root, "assets", "app-store", "subscriptions", "formie-monthly-review.png"),
    png(1290, 2796),
  );
  return root;
}

test("accepts the complete flattened 1290x2796 submission image package", () => {
  const root = createFixture();
  try {
    assert.deepEqual(auditSubmissionAssets(root), []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("rejects missing, incorrectly sized, or transparent submission images", () => {
  const root = createFixture();
  try {
    rmSync(join(root, "assets", "app-store", "ios", "6.9", "final", "03-analysis-in-progress.png"));
    writeFileSync(
      join(root, "assets", "app-store", "ios", "6.9", "final", "04-evidence-linked-correction.png"),
      png(1179, 2556),
    );
    writeFileSync(
      join(root, "assets", "app-store", "ios", "6.9", "final", "05-progress-and-next-set.png"),
      png(1290, 2796, 6),
    );
    rmSync(join(root, "assets", "app-store", "subscriptions", "formie-monthly-review.png"));

    assert.deepEqual(auditSubmissionAssets(root), [
      "Missing final screenshot: 03-analysis-in-progress.png",
      "Final screenshot 04-evidence-linked-correction.png must be 1290x2796; found 1179x2556",
      "Final screenshot 05-progress-and-next-set.png contains an alpha channel or transparency",
      "Missing subscription review screenshot: assets/app-store/subscriptions/formie-monthly-review.png",
    ]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
