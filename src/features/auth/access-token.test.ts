/* eslint-disable import/first */
const mockGetSession = jest.fn();
const mockSignInAnonymously = jest.fn();

jest.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: (...args: unknown[]) => mockGetSession(...args),
      signInAnonymously: (...args: unknown[]) => mockSignInAnonymously(...args),
    },
  },
}));

import { AuthenticationRequiredError, getAccessToken } from "./access-token";

describe("getAccessToken", () => {
  beforeEach(() => {
    mockGetSession.mockReset();
    mockSignInAnonymously.mockReset();
  });

  it("returns the token only for a verified permanent user", async () => {
    mockGetSession.mockResolvedValue({
      data: {
        session: {
          access_token: "verified-token",
          user: { is_anonymous: false, email_confirmed_at: "2026-07-23T12:00:00Z" },
        },
      },
    });

    await expect(getAccessToken()).resolves.toBe("verified-token");
    expect(mockSignInAnonymously).not.toHaveBeenCalled();
  });

  it("does not silently create an anonymous identity", async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });

    await expect(getAccessToken()).rejects.toBeInstanceOf(AuthenticationRequiredError);
    expect(mockSignInAnonymously).not.toHaveBeenCalled();
  });

  it("rejects anonymous and unverified sessions", async () => {
    mockGetSession.mockResolvedValue({ data: { session: { access_token: "guest", user: { is_anonymous: true } } } });
    await expect(getAccessToken()).rejects.toBeInstanceOf(AuthenticationRequiredError);

    mockGetSession.mockResolvedValue({ data: { session: { access_token: "unverified", user: { is_anonymous: false, email_confirmed_at: null } } } });
    await expect(getAccessToken()).rejects.toBeInstanceOf(AuthenticationRequiredError);
  });
});
