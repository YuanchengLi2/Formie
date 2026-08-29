import { createAnalysisHandler, type CreateAnalysisDependencies } from "./handler";

const declaration = {
  exercise: { source: "catalog", catalogExerciseId: 2, label: "Flat Dumbbell Bench Press" },
  amount: { kind: "reps", value: 8, countScope: "total" },
  load: { kind: "known", value: 45, unit: "lb", scope: "per_hand" },
  side: "bilateral",
  styles: [],
  focusNote: null,
};

function dependencies(overrides: Partial<CreateAnalysisDependencies> = {}): CreateAnalysisDependencies {
  return {
    authenticate: jest.fn(async () => "user-123"),
    ownsSession: jest.fn(async () => true),
    findCatalogExercise: jest.fn(async () => ({ id: 2, name: "Flat Dumbbell Bench Press" })),
    createSession: jest.fn(async ({ userId, previousSessionId }) => ({ id: "session-456", userId, previousSessionId })),
    createSignedUpload: jest.fn(async (path) => ({
      signedUrl: path.endsWith("/analysis-input.mp4")
        ? "https://storage.example/analysis-input"
        : "https://storage.example/upload",
      token: path.endsWith("/analysis-input.mp4") ? "analysis-upload-token" : "upload-token",
      path,
    })),
    ...overrides,
  };
}

describe("create analysis handler", () => {
  it("rejects a request without a set declaration", async () => {
    const response = await createAnalysisHandler(
      new Request("https://example.test", { method: "POST", body: JSON.stringify({}) }),
      dependencies(),
    );
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ code: "INVALID_BODY" });
  });

  it("creates an owner-scoped session and signed private upload", async () => {
    const deps = dependencies();
    const response = await createAnalysisHandler(
      new Request("https://example.test", { method: "POST", body: JSON.stringify({ previousSessionId: "prior-1", clientRequestId: "upload-request-1", declaration, privacySafeFallback: true }) }),
      deps,
    );

    expect(response.status).toBe(201);
    expect(deps.ownsSession).toHaveBeenCalledWith("prior-1", "user-123");
    expect(deps.createSession).toHaveBeenCalledWith({ userId: "user-123", previousSessionId: "prior-1", clientRequestId: "upload-request-1", declaration, analyticsContext: null });
    expect(deps.createSignedUpload).toHaveBeenCalledWith("user-123/session-456/original.mp4", { upsert: false });
    expect(deps.createSignedUpload).toHaveBeenCalledWith("user-123/session-456/analysis-input.mp4", { upsert: false });
    expect(deps.createSignedUpload).toHaveBeenCalledWith("user-123/session-456/privacy-safe-upper-body.mp4", { upsert: false });
    await expect(response.json()).resolves.toEqual({
      sessionId: "session-456",
      upload: { signedUrl: "https://storage.example/upload", token: "upload-token", path: "user-123/session-456/original.mp4" },
      analysisUpload: { signedUrl: "https://storage.example/analysis-input", token: "analysis-upload-token", path: "user-123/session-456/analysis-input.mp4" },
      privacySafeUpload: expect.objectContaining({ path: "user-123/session-456/privacy-safe-upper-body.mp4" }),
    });
    expect(deps.createSignedUpload).toHaveBeenCalledTimes(3);
  });

  it("validates and persists optional analytics context", async () => {
    const deps = dependencies();
    const analyticsContext = { captureFlowId: "00000000-0000-4000-8000-000000000011", appSessionId: "00000000-0000-4000-8000-000000000012" };
    const response = await createAnalysisHandler(new Request("https://example.test", { method: "POST", body: JSON.stringify({ declaration, analyticsContext, uploadProfile: "single_analysis_v1" }) }), deps);
    expect(response.status).toBe(201);
    expect(deps.createSession).toHaveBeenCalledWith(expect.objectContaining({ analyticsContext }));
    const invalid = await createAnalysisHandler(new Request("https://example.test", { method: "POST", body: JSON.stringify({ declaration, analyticsContext: { captureFlowId: "bad", appSessionId: analyticsContext.appSessionId } }) }), dependencies());
    expect(invalid.status).toBe(400);
  });

  it("creates only one analysis upload for the single-analysis profile", async () => {
    const deps = dependencies();
    const response = await createAnalysisHandler(
      new Request("https://example.test", {
        method: "POST",
        body: JSON.stringify({ declaration, uploadProfile: "single_analysis_v1" }),
      }),
      deps,
    );

    expect(response.status).toBe(201);
    expect(deps.createSignedUpload).toHaveBeenCalledTimes(1);
    expect(deps.createSignedUpload).toHaveBeenCalledWith("user-123/session-456/analysis-input.mp4", { upsert: false });
    await expect(response.json()).resolves.toEqual({
      sessionId: "session-456",
      analysisUpload: {
        signedUrl: "https://storage.example/analysis-input",
        token: "analysis-upload-token",
        path: "user-123/session-456/analysis-input.mp4",
      },
    });
  });

  it("returns the authoritative remaining quota from the server reservation", async () => {
    const deps = dependencies({
      reserveCredit: jest.fn(async () => ({ reservationId: "reservation-1", status: "reserved", remaining: 9, periodEndsAt: "2026-09-01T00:00:00Z" })),
      attachCredit: jest.fn(async () => undefined),
      cancelCredit: jest.fn(async () => undefined),
    });
    const response = await createAnalysisHandler(new Request("https://example.test", {
      method: "POST",
      body: JSON.stringify({ declaration, clientRequestId: "request-123", uploadProfile: "single_analysis_v1" }),
    }), deps);
    await expect(response.json()).resolves.toMatchObject({ reservationId: "reservation-1", remaining: 9, periodEndsAt: "2026-09-01T00:00:00Z" });
  });

  it("returns the existing live session without creating or charging a duplicate analysis", async () => {
    const deps = dependencies({
      reserveCredit: jest.fn(async () => ({ reservationId: null, status: "analysis_pending", remaining: 8, periodEndsAt: "2026-09-01T00:00:00Z", blockingSessionId: "session-live" })),
    } as never);
    const response = await createAnalysisHandler(new Request("https://example.test", {
      method: "POST",
      body: JSON.stringify({ declaration, clientRequestId: "request-duplicate" }),
    }), deps);
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({ code: "ANALYSIS_PENDING", sessionId: "session-live", remaining: 8 });
    expect(deps.createSession).not.toHaveBeenCalled();
    expect(deps.createSignedUpload).not.toHaveBeenCalled();
  });

  it("does not reserve a privacy-safe artifact when the installed client cannot create one", async () => {
    const deps = dependencies();
    const response = await createAnalysisHandler(
      new Request("https://example.test", {
        method: "POST",
        body: JSON.stringify({ declaration, privacySafeFallback: false }),
      }),
      deps,
    );

    expect(response.status).toBe(201);
    expect(deps.createSignedUpload).toHaveBeenCalledTimes(2);
    await expect(response.json()).resolves.not.toHaveProperty("privacySafeUpload");
  });

  it("does not link a previous session owned by someone else", async () => {
    const response = await createAnalysisHandler(
      new Request("https://example.test", { method: "POST", body: JSON.stringify({ previousSessionId: "not-mine", declaration }) }),
      dependencies({ ownsSession: jest.fn(async () => false) }),
    );
    expect(response.status).toBe(404);
  });

  it("uses the catalog name as the canonical declared label", async () => {
    const deps = dependencies();
    const response = await createAnalysisHandler(
      new Request("https://example.test", {
        method: "POST",
        body: JSON.stringify({
          declaration: {
            ...declaration,
            exercise: { ...declaration.exercise, label: "DB bench" },
          },
        }),
      }),
      deps,
    );
    expect(response.status).toBe(201);
    expect(deps.createSession).toHaveBeenCalledWith({ userId: "user-123", previousSessionId: null, clientRequestId: null, declaration, analyticsContext: null });
  });

  it("rejects a catalog declaration whose exercise no longer exists", async () => {
    const response = await createAnalysisHandler(
      new Request("https://example.test", { method: "POST", body: JSON.stringify({ declaration }) }),
      dependencies({ findCatalogExercise: jest.fn(async () => null) }),
    );
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ code: "INVALID_EXERCISE" });
  });
});
