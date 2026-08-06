import { deriveAuthPhase } from "./auth-state";

describe("deriveAuthPhase", () => {
  it("keeps startup covered until the persisted session is known", () => {
    expect(deriveAuthPhase({ initializing: true, session: null })).toBe("initializing");
  });

  it("distinguishes signed-out and authenticated social sessions", () => {
    expect(deriveAuthPhase({ initializing: false, session: null })).toBe("signed_out");
    expect(deriveAuthPhase({ initializing: false, session: { isAnonymous: false } })).toBe("authenticated");
  });

  it("removes legacy anonymous sessions from permanent app access", () => {
    expect(deriveAuthPhase({ initializing: false, session: { isAnonymous: true } })).toBe("signed_out");
  });
});
