import { analysisProgress } from "./progress-stages";

describe("v46 analysis progress stages", () => {
  it("shows upload preparation substages", () => {
    expect(analysisProgress("normalizing").items[0]).toMatchObject({ label: "Preparing video for analysis", state: "active" });
    expect(analysisProgress("uploading_analysis").items[0].label).toBe("Uploading analysis copy");
  });

  it("shows watching, finalizing, and complete", () => {
    expect(analysisProgress("analyzing")).toMatchObject({ activeIndex: 1, items: [
      { key: "uploading", state: "complete" },
      { key: "mapping", label: "Watching the complete exercise", state: "active" },
      { key: "finalizing", state: "pending" },
      { key: "complete", state: "pending" },
    ] });
    expect(analysisProgress("finalizing").activeIndex).toBe(2);
  });

  it("shows durable retries as finishing coaching", () => {
    expect(analysisProgress("retry_wait")).toMatchObject({ activeIndex: 2, items: expect.arrayContaining([{ key: "mapping", label: "Finishing your coaching", state: "complete" }]) });
  });

  it("keeps a failed analysis terminal", () => {
    expect(analysisProgress("failed")).toMatchObject({ activeIndex: 3, items: expect.arrayContaining([{ key: "complete", label: "Analysis failed", state: "active" }]) });
  });
});
