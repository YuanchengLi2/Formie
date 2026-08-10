import { statSync } from "node:fs";
import { resolve } from "node:path";

const artworkFiles = [
  "assets/production/onboarding/extracted/01-welcome-illustration.png",
  "assets/production/onboarding/extracted/03-product-value-illustration.webp",
  "assets/production/onboarding/extracted/06-why-formie-illustration.webp",
  "assets/production/onboarding/extracted/09-product-demonstration-center.webp",
  "assets/production/onboarding/extracted/14-long-term-value-illustration.webp",
  "assets/production/onboarding/extracted/15-loading-illustration.png",
  "assets/production/onboarding/generated/product-demonstration-coaching-overlay.png",
];

describe("onboarding artwork delivery", () => {
  it("keeps the bundled artwork set small enough to decode promptly", () => {
    const totalBytes = artworkFiles.reduce((total, path) => total + statSync(resolve(process.cwd(), path)).size, 0);
    expect(totalBytes).toBeLessThan(3_500_000);
  });
});
