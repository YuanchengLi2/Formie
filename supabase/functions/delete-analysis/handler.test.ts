import { deleteAnalysisHandler } from "./handler";

describe("delete analysis handler", () => {
  it("removes the original video and every private analysis artifact before deleting the session", async () => {
    const removedVideos: string[][] = [];
    const removedArtifacts: string[][] = [];
    const deletedSessions: string[] = [];
    const response = await deleteAnalysisHandler(
      new Request("https://example.test/delete-analysis", {
        method: "DELETE",
        body: JSON.stringify({ sessionId: "session-1" }),
      }),
      {
        authenticate: async () => "user-1",
        findSession: async () => ({
          id: "session-1",
          videoPath: "user-1/session-1/original.mp4",
          artifactPaths: ["user-1/session-1/pose-evidence.json"],
        }),
        removeVideos: async (paths) => { removedVideos.push(paths); },
        removeArtifacts: async (paths) => { removedArtifacts.push(paths); },
        deleteSession: async (sessionId) => { deletedSessions.push(sessionId); },
      },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ deleted: true });
    expect(removedVideos).toEqual([["user-1/session-1/original.mp4"]]);
    expect(removedArtifacts).toEqual([["user-1/session-1/pose-evidence.json"]]);
    expect(deletedSessions).toEqual(["session-1"]);
  });

  it("does not delete storage for a session the user does not own", async () => {
    const removeArtifacts = jest.fn();
    const response = await deleteAnalysisHandler(
      new Request("https://example.test/delete-analysis", {
        method: "DELETE",
        body: JSON.stringify({ sessionId: "missing" }),
      }),
      {
        authenticate: async () => "user-1",
        findSession: async () => null,
        removeVideos: jest.fn(),
        removeArtifacts,
        deleteSession: jest.fn(),
      },
    );

    expect(response.status).toBe(404);
    expect(removeArtifacts).not.toHaveBeenCalled();
  });
});
