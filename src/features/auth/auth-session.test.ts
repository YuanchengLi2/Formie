import { authSnapshotFromSession, classifyRemoteUserValidationError, withRemoteValidationDeadline } from "./auth-session";

describe("authSnapshotFromSession", () => {
  it("returns null without a session", () => {
    expect(authSnapshotFromSession(null)).toBeNull();
  });

  it("recognizes anonymous and permanent social sessions without password state", () => {
    expect(authSnapshotFromSession({
      user: { is_anonymous: true, email_confirmed_at: null, user_metadata: {} },
    })).toEqual({ isAnonymous: true });

    expect(authSnapshotFromSession({
      user: {
        is_anonymous: false,
        email_confirmed_at: "2026-07-23T12:00:00Z",
        user_metadata: {},
      },
    })).toEqual({ isAnonymous: false });
  });
});

describe("classifyRemoteUserValidationError", () => {
  it.each([
    { status: 401, message: "User from sub claim in JWT does not exist" },
    { status: 403, code: "user_not_found", message: "User not found" },
  ])("classifies confirmed missing or revoked users as invalid", (error) => {
    expect(classifyRemoteUserValidationError(error)).toBe("invalid_session");
  });

  it.each([
    new TypeError("Network request failed"),
    { status: 503, message: "upstream unavailable" },
    { status: 429, message: "rate limited" },
  ])("keeps transient failures distinct from invalid sessions", (error) => {
    expect(classifyRemoteUserValidationError(error)).toBe("transient");
  });
});

describe("withRemoteValidationDeadline", () => {
  it("does not let a stalled provider request block startup forever", async () => {
    await expect(withRemoteValidationDeadline(new Promise(() => undefined), 5)).rejects.toMatchObject({ code: "validation_timeout" });
  });

  it("returns a provider response that settles before the deadline", async () => {
    await expect(withRemoteValidationDeadline(Promise.resolve("verified"), 50)).resolves.toBe("verified");
  });
});
