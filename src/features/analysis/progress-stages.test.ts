import { analysisProgress } from "./progress-stages";

describe("analysis progress stages", () => {
  it("shows the real upload substage instead of a generic securing label", () => {
    expect(analysisProgress("normalizing").items[0]).toMatchObject({
      label: "Preparing video for analysis",
      state: "active",
    });
    expect(analysisProgress("uploading_analysis").items[0].label).toBe("Uploading analysis copy");
  });

  it("maps the single-pass backend stages to the four user-facing phases", () => {
    expect(analysisProgress("analyzing")).toMatchObject({
      activeIndex: 1,
      items: [
        { key: "uploading", label: "Securing your recording", state: "complete" },
        { key: "mapping", label: "Analyzing the full set", state: "active" },
        { key: "evidence", label: "Selecting the best evidence", state: "pending" },
        { key: "coaching", label: "Writing your coaching", state: "pending" },
      ],
    });
    expect(analysisProgress("selecting_evidence").activeIndex).toBe(2);
    expect(analysisProgress("checking_consistency").items[2]).toMatchObject({
      label: "Checking facts and coaching",
      state: "active",
    });
    expect(analysisProgress("double_checking").items[2]).toMatchObject({
      label: "Double-checking a video detail",
      state: "active",
    });
    expect(analysisProgress("writing_coaching").activeIndex).toBe(3);
    expect(analysisProgress("coaching").activeIndex).toBe(3);
  });

  it("starts at secure upload when no persisted stage exists yet", () => {
    const progress = analysisProgress(null);
    expect(progress.activeIndex).toBe(0);
    expect(progress.items[0]).toMatchObject({ key: "uploading", state: "active" });
    expect(progress.items.slice(1).every((item) => item.state === "pending")).toBe(true);
  });
});
