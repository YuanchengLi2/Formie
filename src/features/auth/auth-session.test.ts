import { authSnapshotFromSession } from "./auth-session";

describe("authSnapshotFromSession", () => {
  it("returns null without a session", () => {
    expect(authSnapshotFromSession(null)).toBeNull();
  });

  it("recognizes anonymous and verified sessions without payment metadata", () => {
    expect(authSnapshotFromSession({
      user: { is_anonymous: true, email_confirmed_at: null, user_metadata: {} },
    })).toEqual({ isAnonymous: true, emailVerified: false });

    expect(authSnapshotFromSession({
      user: {
        is_anonymous: false,
        email_confirmed_at: "2026-07-23T12:00:00Z",
        user_metadata: {},
      },
    })).toEqual({ isAnonymous: false, emailVerified: true });
  });
});
