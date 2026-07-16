import { exerciseTutorialHandler, type ExerciseTutorialDependencies } from "./handler";

const tutorial = {
  videoId: "abcdefghijk",
  url: "https://www.youtube.com/watch?v=abcdefghijk",
  title: "How to Hammer Curl",
  channel: "Trusted Coach",
  whyChosen: "Clear setup, execution, and common mistakes.",
  thumbnailUrl: "https://i.ytimg.com/vi/abcdefghijk/hqdefault.jpg",
  searchAttributionHtml: null,
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
    loadSession: jest.fn(async () => ({ id: "session-1", status: "complete", label: "Hammer Curl", tutorial: null })),
    findTutorial: jest.fn(async () => tutorial),
    saveTutorial: jest.fn(async () => undefined),
    ...overrides,
  };
}

describe("exerciseTutorialHandler", () => {
  it("searches once after a completed exercise analysis and caches the verified video", async () => {
    const deps = dependencies();
    const response = await exerciseTutorialHandler(request(), deps);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ tutorial });
    expect(deps.findTutorial).toHaveBeenCalledWith("Hammer Curl");
    expect(deps.saveTutorial).toHaveBeenCalledWith("session-1", tutorial);
  });

  it("returns a cached tutorial without another AI search", async () => {
    const deps = dependencies({
      loadSession: jest.fn(async () => ({ id: "session-1", status: "complete", label: "Hammer Curl", tutorial })),
    });
    expect(await (await exerciseTutorialHandler(request(), deps)).json()).toEqual({ tutorial });
    expect(deps.findTutorial).not.toHaveBeenCalled();
  });

  it("does not search for an unusable or unidentified recording", async () => {
    const deps = dependencies({
      loadSession: jest.fn(async () => ({ id: "session-1", status: "unable", label: null, tutorial: null })),
    });
    expect(await (await exerciseTutorialHandler(request(), deps)).json()).toEqual({ tutorial: null });
    expect(deps.findTutorial).not.toHaveBeenCalled();
  });
});
