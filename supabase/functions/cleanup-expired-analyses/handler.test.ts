import {
  cleanupExpiredAnalysesHandler,
  isRetentionEligible,
  type RetentionCandidate,
} from "./handler";

const optedInAt = "2026-07-01T00:00:00.000Z";
const now = new Date("2026-08-15T00:00:00.000Z");

describe("expired analysis retention cleanup", () => {
  it("excludes pre-opt-in and newer sessions at the 30-day boundary", () => {
    expect(isRetentionEligible({
      createdAt: "2026-06-30T23:59:59.000Z",
      retentionEffectiveAt: optedInAt,
      videoRetentionDays: 30,
    }, now)).toBe(false);
    expect(isRetentionEligible({
      createdAt: "2026-07-20T00:00:00.000Z",
      retentionEffectiveAt: optedInAt,
      videoRetentionDays: 30,
    }, now)).toBe(false);
    expect(isRetentionEligible({
      createdAt: "2026-07-10T00:00:00.000Z",
      retentionEffectiveAt: optedInAt,
      videoRetentionDays: 30,
    }, now)).toBe(true);
    expect(isRetentionEligible({
      createdAt: "2026-07-10T00:00:00.000Z",
      retentionEffectiveAt: optedInAt,
      videoRetentionDays: null,
    }, now)).toBe(false);
  });

  it("removes storage before deleting sessions and is idempotent when none remain", async () => {
    const candidate: RetentionCandidate = {
      id: "session-1",
      userId: "user-1",
      videoPath: "user-1/session-1/original.mp4",
      analysisVideoPath: "user-1/session-1/analysis-input.mp4",
      artifactPaths: ["user-1/session-1/pose.json"],
      geminiFileName: "files/session-1",
    };
    const calls: string[] = [];
    const dependencies = {
      authenticate: jest.fn(async () => undefined),
      findEligible: jest.fn()
        .mockResolvedValueOnce([candidate])
        .mockResolvedValueOnce([]),
      removeStorage: jest.fn(async () => { calls.push("storage"); }),
      deleteGeminiFile: jest.fn(async () => { calls.push("gemini"); return "complete" as const; }),
      deleteSession: jest.fn(async () => { calls.push("session"); }),
    };

    const first = await cleanupExpiredAnalysesHandler(
      new Request("https://example.test/cleanup", { method: "POST" }),
      dependencies,
      now,
    );
    expect(await first.json()).toEqual({ deleted: 1, externalCleanupQueued: 0 });
    expect(dependencies.removeStorage).toHaveBeenCalledWith([
      "user-1/session-1/original.mp4",
      "user-1/session-1/analysis-input.mp4",
      "user-1/session-1/pose.json",
    ]);
    expect(calls).toEqual(["gemini", "storage", "session"]);

    const second = await cleanupExpiredAnalysesHandler(
      new Request("https://example.test/cleanup", { method: "POST" }),
      dependencies,
      now,
    );
    expect(await second.json()).toEqual({ deleted: 0, externalCleanupQueued: 0 });
  });

  it("rejects an unauthenticated cleanup request", async () => {
    const response = await cleanupExpiredAnalysesHandler(
      new Request("https://example.test/cleanup", { method: "POST" }),
      {
        authenticate: jest.fn(async () => { throw new Error("UNAUTHORIZED"); }),
        findEligible: jest.fn(),
        removeStorage: jest.fn(),
        deleteGeminiFile: jest.fn(),
        deleteSession: jest.fn(),
      },
      now,
    );
    expect(response.status).toBe(401);
  });
});
