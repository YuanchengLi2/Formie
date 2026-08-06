import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("whole-video terminal state wiring", () => {
  it("does not let a concurrent stage writer regress a committed result", () => {
    const source = readFileSync(resolve(__dirname, "index.ts"), "utf8");
    const saveStage = source.slice(
      source.indexOf("const saveSessionStage"),
      source.indexOf("return advanceWholeVideoPipeline"),
    );

    expect(saveStage).toContain('.not("status", "in", "(complete,partial,unable,failed)")');
  });
});
