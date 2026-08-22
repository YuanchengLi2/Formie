import { readdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { extname, join } from "node:path";

const testRoots = ["app", "components", "lib"];
const testExtensions = new Set([".ts", ".tsx"]);

async function findTestFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const path = join(directory, entry.name);

      if (entry.isDirectory()) {
        return findTestFiles(path);
      }

      return entry.name.includes(".test.") && testExtensions.has(extname(entry.name))
        ? [path]
        : [];
    }),
  );

  return files.flat();
}

const testFiles = (await Promise.all(testRoots.map(findTestFiles))).flat().sort();

if (testFiles.length === 0) {
  console.error("No website test files were found.");
  process.exit(1);
}

const result = spawnSync(
  process.execPath,
  ["--import", "tsx", "--test", ...testFiles],
  { stdio: "inherit" },
);

if (result.error) {
  throw result.error;
}

process.exit(result.status ?? 1);
