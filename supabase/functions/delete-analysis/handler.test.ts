import { deleteAnalysisHandler } from "./handler";

describe("delete analysis handler", () => {
  it("removes the original video before deleting the Gemini-only session", async () => {
    const removedVideos: string[][] = [];
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
          analysisVideoPath: "user-1/session-1/analysis-input.mp4",
          artifactPaths: ["user-1/session-1/keyframes/00.jpg", "user-1/session-1/keyframes/01.jpg", "user-1/session-1/exact-frames/00.jpg", "user-1/session-1/pose/landmarks-v3.json"],
        }),
        removeVideos: async (paths) => { removedVideos.push(paths); },
        deleteSession: async (sessionId) => { deletedSessions.push(sessionId); },
      },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ deleted: true });
    expect(removedVideos).toEqual([["user-1/session-1/original.mp4", "user-1/session-1/analysis-input.mp4", "user-1/session-1/keyframes/00.jpg", "user-1/session-1/keyframes/01.jpg", "user-1/session-1/exact-frames/00.jpg", "user-1/session-1/pose/landmarks-v3.json"]]);
    expect(deletedSessions).toEqual(["session-1"]);
  });

  it("does not delete storage for a session the user does not own", async () => {
    const removeVideos = jest.fn();
    const response = await deleteAnalysisHandler(
      new Request("https://example.test/delete-analysis", {
        method: "DELETE",
        body: JSON.stringify({ sessionId: "missing" }),
      }),
      {
        authenticate: async () => "user-1",
        findSession: async () => null,
        removeVideos,
        deleteSession: jest.fn(),
      },
    );

    expect(response.status).toBe(404);
    expect(removeVideos).not.toHaveBeenCalled();
  });
});
