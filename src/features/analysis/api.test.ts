import { AnalysisApiError, correctAnalysisLabel, createAnalysisSession } from "./api";

describe("analysis API", () => {
  it("creates a session without requiring exercise selection", async () => {
    const fetcher = jest.fn(async () =>
      new Response(
        JSON.stringify({
          sessionId: "session-123",
          upload: { signedUrl: "https://storage.example/upload", token: "upload-token", path: "user/session.mp4" },
        }),
        { status: 201, headers: { "Content-Type": "application/json" } },
      ),
    );

    const response = await createAnalysisSession({
      accessToken: "user-jwt",
      baseUrl: "https://example.supabase.co/functions/v1",
      fetcher,
    });

    expect(response.sessionId).toBe("session-123");
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledWith(
      "https://example.supabase.co/functions/v1/create-analysis",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer user-jwt",
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({}),
      }),
    );
  });

  it("links a repeat recording to the previous session", async () => {
    const fetcher = jest.fn(async () =>
      new Response(
        JSON.stringify({
          sessionId: "session-456",
          upload: { signedUrl: "https://storage.example/upload", token: "upload-token", path: "user/session.mp4" },
        }),
        { status: 201, headers: { "Content-Type": "application/json" } },
      ),
    );

    await createAnalysisSession({
      previousSessionId: "session-123",
      accessToken: "user-jwt",
      baseUrl: "https://example.supabase.co/functions/v1",
      fetcher,
    });

    expect(fetcher).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ body: JSON.stringify({ previousSessionId: "session-123" }) }),
    );
  });

  it("throws a typed error for a rejected request", async () => {
    const fetcher = jest.fn(async () =>
      new Response(JSON.stringify({ code: "UNAUTHORIZED", message: "Sign in again" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(createAnalysisSession({ accessToken: "expired", baseUrl: "https://example.supabase.co/functions/v1", fetcher })).rejects.toEqual(
      new AnalysisApiError("Sign in again", 401, "UNAUTHORIZED"),
    );
  });

  it("sends an optional user correction without replacing the detected label", async () => {
    const fetcher = jest.fn(async () =>
      new Response(JSON.stringify({ corrected: true }), { status: 200, headers: { "Content-Type": "application/json" } }),
    );

    await correctAnalysisLabel({
      accessToken: "user-jwt",
      baseUrl: "https://example.supabase.co/functions/v1",
      fetcher,
      sessionId: "session-123",
      label: "FreeMotion high-to-low row",
    });

    expect(fetcher).toHaveBeenCalledWith(
      "https://example.supabase.co/functions/v1/correct-analysis-label",
      expect.objectContaining({ body: JSON.stringify({ sessionId: "session-123", label: "FreeMotion high-to-low row" }) }),
    );
  });
});
