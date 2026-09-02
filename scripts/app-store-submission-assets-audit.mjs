import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

export function readPngMetadata(path) {
  const bytes = readFileSync(path);
  if (bytes.length < 33 || !bytes.subarray(0, 8).equals(PNG_SIGNATURE) || bytes.toString("ascii", 12, 16) !== "IHDR") {
    throw new Error("invalid PNG header");
  }

  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  const colorType = bytes[25];
  let hasTransparency = colorType === 4 || colorType === 6;
  let offset = 8;

  while (offset + 12 <= bytes.length) {
    const length = bytes.readUInt32BE(offset);
    const type = bytes.toString("ascii", offset + 4, offset + 8);
    const nextOffset = offset + 12 + length;
    if (nextOffset > bytes.length) throw new Error("invalid PNG chunk length");
    if (type === "tRNS") hasTransparency = true;
    offset = nextOffset;
    if (type === "IEND") break;
  }

  return { width, height, hasTransparency };
}

function auditPng(failures, path, label, width, height) {
  if (!existsSync(path)) {
    failures.push(`Missing ${label}`);
    return;
  }

  try {
    const metadata = readPngMetadata(path);
    const displayLabel = `${label[0].toUpperCase()}${label.slice(1)}`.replace(": ", " ");
    if (metadata.width !== width || metadata.height !== height) {
      failures.push(`${displayLabel} must be ${width}x${height}; found ${metadata.width}x${metadata.height}`);
    }
    if (metadata.hasTransparency) {
      failures.push(`${displayLabel} contains an alpha channel or transparency`);
    }
  } catch (error) {
    const displayLabel = `${label[0].toUpperCase()}${label.slice(1)}`.replace(": ", " ");
    failures.push(`${displayLabel} is not a valid flattened PNG: ${error.message}`);
  }
}

export function auditSubmissionAssets(root = process.cwd()) {
  const failures = [];
  const gates = JSON.parse(readFileSync(join(root, "docs", "app-store", "1.0-release-gates.json"), "utf8"));
  const { width, height } = gates.screenshotCanvas;

  for (const name of gates.screenshotOrder) {
    auditPng(
      failures,
      join(root, "assets", "app-store", "ios", "6.9", "final", name),
      `final screenshot: ${name}`,
      width,
      height,
    );
  }

  const review = gates.subscriptionReviewScreenshot;
  auditPng(
    failures,
    join(root, ...review.path.split("/")),
    `subscription review screenshot: ${review.path}`,
    review.width,
    review.height,
  );

  return failures;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const failures = auditSubmissionAssets();
  if (failures.length) {
    console.error(failures.map((failure) => `- ${failure}`).join("\n"));
    process.exit(1);
  }
  console.log("[app-store-submission-assets] ordered flattened image package passed");
}
