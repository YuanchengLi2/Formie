import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("Expo Camera iOS initialization patch", () => {
  it("waits for React props before selecting the initial physical camera", () => {
    const patch = readFileSync(
      resolve(process.cwd(), "patches/expo-camera+57.0.4.patch"),
      "utf8",
    );

    expect(patch).toContain("view.initializeCaptureSessionIfNeeded()");
    expect(patch).toContain("private var didInitializeCaptureSession = false");
    expect(patch).toContain("func initializeCaptureSessionIfNeeded()");
    expect(patch).toMatch(/lifecycleManager\?\.register\(self\)\r?\n\+  \}/);
  });
});
