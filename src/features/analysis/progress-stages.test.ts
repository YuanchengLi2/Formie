import { analysisProgress } from "./progress-stages";

describe("analysis progress stages", () => {
  it("marks persisted stages before the current stage complete", () => {
    expect(analysisProgress("technique_review")).toMatchObject({
      activeIndex: 3,
      items: [
        { key: "uploading", state: "complete" },
        { key: "video_check", state: "complete" },
        { key: "video_processing", state: "complete" },
        { key: "technique_review", state: "active" },
        { key: "coaching", state: "pending" },
      ],
    });
  });

  it("starts at secure upload when no persisted stage exists yet", () => {
    const progress = analysisProgress(null);

    expect(progress.activeIndex).toBe(0);
    expect(progress.items[0]).toMatchObject({ key: "uploading", state: "active" });
    expect(progress.items.slice(1).every((item) => item.state === "pending")).toBe(true);
  });
});
