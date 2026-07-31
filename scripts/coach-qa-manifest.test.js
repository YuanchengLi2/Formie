const fs = require("node:fs");
const path = require("node:path");

const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "benchmarks", "coach-qa", "manifest.json"), "utf8"));

describe("coach QA manifest", () => {
  it("contains 20 human-labeled questions across five real recordings", () => {
    expect(manifest.cases).toHaveLength(20);
    expect(new Set(manifest.cases.map((item) => item.video.id)).size).toBeGreaterThanOrEqual(5);
    expect(new Set(manifest.cases.map((item) => item.id)).size).toBe(20);
    for (const item of manifest.cases) {
      expect(item.question.length).toBeGreaterThan(10);
      expect(item.humanLabel.summary.length).toBeGreaterThan(10);
      expect(item.video.durationMs).toBeGreaterThan(1_000);
    }
  });

  it("covers every required question class and includes deliberate unanswerable cases", () => {
    const categories = new Set(manifest.cases.map((item) => item.category));
    expect(categories).toEqual(new Set(["rep_reference", "timestamp", "movement_description", "early_late_comparison", "fresh_observation", "unanswerable_visibility"]));
    expect(manifest.cases.filter((item) => item.category === "unanswerable_visibility")).toHaveLength(5);
    expect(manifest.cases.filter((item) => Number.isFinite(item.expectedTimestampMs)).length).toBeGreaterThanOrEqual(10);
  });
});
