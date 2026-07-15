import { createAnalysisHandler, type CreateAnalysisDependencies } from "./handler";

function dependencies(overrides: Partial<CreateAnalysisDependencies> = {}): CreateAnalysisDependencies {
  return {
    authenticate: jest.fn(async () => "user-123"),
    ownsSession: jest.fn(async () => true),
    insertSession: jest.fn(async ({ userId, previousSessionId }) => ({ id: "session-456", userId, previousSessionId })),
    createSignedUpload: jest.fn(async (path) => ({ signedUrl: "https://storage.example/upload", token: "upload-token", path })),
    ...overrides,
  };
}

describe("create analysis handler", () => {
  it("rejects exercise selection because recognition is automatic", async () => {
    const response = await createAnalysisHandler(
      new Request("https://example.test", { method: "POST", body: JSON.stringify({ exerciseId: 12 }) }),
      dependencies(),
    );
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ code: "INVALID_BODY" });
  });

  it("creates an owner-scoped session and signed private upload", async () => {
    const deps = dependencies();
    const response = await createAnalysisHandler(
      new Request("https://example.test", { method: "POST", body: JSON.stringify({ previousSessionId: "prior-1" }) }),
      deps,
    );

    expect(response.status).toBe(201);
    expect(deps.ownsSession).toHaveBeenCalledWith("prior-1", "user-123");
    expect(deps.insertSession).toHaveBeenCalledWith({ userId: "user-123", previousSessionId: "prior-1" });
    expect(deps.createSignedUpload).toHaveBeenCalledWith("user-123/session-456/original.mp4");
    await expect(response.json()).resolves.toEqual({
      sessionId: "session-456",
      upload: { signedUrl: "https://storage.example/upload", token: "upload-token", path: "user-123/session-456/original.mp4" },
    });
  });

  it("does not link a previous session owned by someone else", async () => {
    const response = await createAnalysisHandler(
      new Request("https://example.test", { method: "POST", body: JSON.stringify({ previousSessionId: "not-mine" }) }),
      dependencies({ ownsSession: jest.fn(async () => false) }),
    );
    expect(response.status).toBe(404);
  });
});
