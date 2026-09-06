const { execFileSync } = require("node:child_process");
const path = require("node:path");

describe("Metro resource limits", () => {
  it("keeps the transformer worker pool small enough for local development", () => {
    const workspace = path.resolve(__dirname, "..");
    const output = execFileSync(
      process.execPath,
      ["-e", "const config=require('./metro.config'); const rules=[config.resolver.blockList].flat().filter(Boolean).map(String); const hasNestedBlockList=Array.isArray(config.resolver.blockList)&&config.resolver.blockList.some(Array.isArray); process.stdout.write(JSON.stringify({maxWorkers:config.maxWorkers,useWatchman:config.resolver.useWatchman,blockList:rules,hasNestedBlockList,projectRoot:process.cwd()}))"],
      { cwd: workspace, encoding: "utf8" },
    );
    const config = JSON.parse(output);

    expect(config.maxWorkers).toBe(1);
    if (process.platform === "win32") {
      expect(config.useWatchman).toBe(false);
    }
    expect(config.hasNestedBlockList).toBe(false);
    const blockList = config.blockList.map((rule) => new RegExp(rule.slice(1, rule.lastIndexOf("/"))));
    // metro-file-map normalizes Windows separators to POSIX before applying
    // the watcher ignore pattern. Keep this test aligned with that runtime.
    const blocked = (candidate) => blockList.some((rule) => rule.test(candidate.split(path.sep).join("/")));
    expect(blocked(path.join(config.projectRoot, ".worktrees", "feature", "node_modules", "package", "index.js"))).toBe(true);
    expect(blocked(path.join(config.projectRoot, "dist-android-check", "_expo", "static", "js", "bundle.js"))).toBe(true);
    expect(blocked(path.join(config.projectRoot, "src", "app", "_layout.tsx"))).toBe(false);
    expect(blocked(path.join(config.projectRoot, "assets", "production", "paywall.png"))).toBe(false);
    expect(blocked(path.join(config.projectRoot, "node_modules", "whatwg-fetch", "dist", "fetch.umd.js"))).toBe(false);
  });
});
