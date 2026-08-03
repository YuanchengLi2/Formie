import { historicalAnalysisArtifactPaths } from "./legacy-analysis-artifacts";

describe("historical analysis artifact cleanup", () => {
  it("keeps old exact-frame files removable without exposing them to v46", () => {
    const paths = historicalAnalysisArtifactPaths("user-1", "session-1");
    expect(paths).toHaveLength(25);
    expect(paths[0]).toBe("user-1/session-1/exact-frames/00.jpg");
    expect(paths[24]).toBe("user-1/session-1/exact-frames/24.jpg");
  });
});
