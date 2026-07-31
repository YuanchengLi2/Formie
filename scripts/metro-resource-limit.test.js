const { execFileSync } = require("node:child_process");
const path = require("node:path");

describe("Metro resource limits", () => {
  it("keeps the transformer worker pool small enough for local development", () => {
    const workspace = path.resolve(__dirname, "..");
    const output = execFileSync(
      process.execPath,
      ["-e", "const config=require('./metro.config'); process.stdout.write(JSON.stringify({maxWorkers:config.maxWorkers}))"],
      { cwd: workspace, encoding: "utf8" },
    );
    const config = JSON.parse(output);

    expect(config.maxWorkers).toBe(1);
  });
});
