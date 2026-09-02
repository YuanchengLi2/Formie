import { exerciseTutorialHandler, type ExerciseTutorialDependencies } from "./handler";

const tutorial = {
  source: "youtube_data_api_v3" as const,
  videoId: "abcdefghijk",
  url: "https://www.youtube.com/watch?v=abcdefghijk",
  title: "How to Hammer Curl",
  channel: "Trusted Coach",
  channelId: "channel-1",
  thumbnailUrl: "https://i.ytimg.com/vi/abcdefghijk/hqdefault.jpg",
  durationSeconds: 360,
  verifiedAt: "2026-09-01T12:00:00.000Z",
  eligibilityVersion: "youtube-tutorial-v1",
};

function request() {
  return new Request("https://example.test/exercise-tutorial", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId: "session-1" }),
  });
}

function dependencies(overrides: Partial<ExerciseTutorialDependencies> = {}): ExerciseTutorialDependencies {
  return {
    authenticate: jest.fn(async () => "user-1"),
    loadSession: jest.fn(async () => ({ id: "session-1", status: "complete", catalogExerciseId: 42, canonicalLabel: "Hammer Curl" })),
    resolveTutorial: jest.fn(async () => tutorial),
    ...overrides,
  };
}

describe("exerciseTutorialHandler", () => {
  it("resolves a revalidated global tutorial for a completed catalog exercise", async () => {
    const deps = dependencies();
    const response = await exerciseTutorialHandler(request(), deps);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ tutorial });
    expect(deps.resolveTutorial).toHaveBeenCalledWith("Hammer Curl");
  });

  it("does not search for an unusable or unidentified recording", async () => {
    const deps = dependencies({
      loadSession: jest.fn(async () => ({ id: "session-1", status: "unable", catalogExerciseId: null, canonicalLabel: null })),
    });
    expect(await (await exerciseTutorialHandler(request(), deps)).json()).toEqual({ tutorial: null });
    expect(deps.resolveTutorial).not.toHaveBeenCalled();
  });
});
