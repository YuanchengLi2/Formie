import { readdirSync } from "node:fs";
import { join } from "node:path";

function collectTestFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);

    if (entry.isDirectory()) {
      return collectTestFiles(path);
    }

    return /\.(?:test|spec)\.[cm]?[jt]sx?$/.test(entry.name) ? [path] : [];
  });
}

describe("Expo Router route hygiene", () => {
  it("keeps test modules outside src/app so they are not imported on-device", () => {
    expect(collectTestFiles(join(__dirname, "app"))).toEqual([]);
  });
});
