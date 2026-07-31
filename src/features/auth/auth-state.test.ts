import { deriveAuthPhase } from "./auth-state";

describe("deriveAuthPhase", () => {
  it("keeps the app covered while the initial session is loading", () => {
    expect(deriveAuthPhase({ initializing: true, session: null })).toBe("initializing");
  });

  it("routes signed-out and pending-verification users correctly", () => {
    expect(deriveAuthPhase({ initializing: false, session: null })).toBe("signed_out");
    expect(deriveAuthPhase({ initializing: false, session: null, pendingVerificationEmail: "user@example.com" })).toBe("verification_pending");
  });

  it("treats legacy anonymous users as signed out", () => {
    expect(deriveAuthPhase({
      initializing: false,
      session: { isAnonymous: true, emailVerified: false },
    })).toBe("signed_out");
  });

  it("prioritizes recovery before authenticated access", () => {
    const verified = { isAnonymous: false, emailVerified: true };
    expect(deriveAuthPhase({ initializing: false, session: verified, recoveryMode: true })).toBe("password_recovery");
    expect(deriveAuthPhase({ initializing: false, session: verified })).toBe("authenticated");
  });

  it("never authenticates a permanent session whose email is unverified", () => {
    expect(deriveAuthPhase({
      initializing: false,
      session: { isAnonymous: false, emailVerified: false },
    })).toBe("verification_pending");
  });
});
