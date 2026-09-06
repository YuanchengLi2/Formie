import type { User } from "@supabase/supabase-js";

import { presentAccountIdentity } from "./account-identity";

function user(overrides: Partial<User>): User {
  return {
    id: "user-1",
    app_metadata: {},
    user_metadata: {},
    aud: "authenticated",
    created_at: "2026-09-03T00:00:00.000Z",
    ...overrides,
  } as User;
}

describe("account identity presentation", () => {
  it("labels an Apple private relay identity without exposing the relay address", () => {
    expect(presentAccountIdentity(user({
      email: "random@privaterelay.appleid.com",
      app_metadata: { provider: "apple", providers: ["apple"] },
    }))).toEqual({
      provider: "apple",
      title: "Sign in with Apple",
      detail: "Private Relay email",
      usesPrivateRelay: true,
    });
  });

  it("shows a verified non-relay Apple email", () => {
    expect(presentAccountIdentity(user({
      email: "athlete@example.com",
      identities: [{ provider: "apple" }] as User["identities"],
    }))).toMatchObject({ provider: "apple", title: "Sign in with Apple", detail: "athlete@example.com", usesPrivateRelay: false });
  });

  it("labels the reviewer password identity as email", () => {
    expect(presentAccountIdentity(user({
      email: "appreview@formie.app",
      app_metadata: { provider: "email", providers: ["email"] },
    }))).toMatchObject({ provider: "email", title: "Email account", detail: "appreview@formie.app", usesPrivateRelay: false });
  });

  it("does not mistake malformed or lookalike domains for Apple private relay", () => {
    expect(presentAccountIdentity(user({ email: "random@privaterelay.appleid.com.example", app_metadata: {} }))).toMatchObject({
      provider: "email",
      usesPrivateRelay: false,
    });
  });

  it("handles missing metadata and email safely", () => {
    expect(presentAccountIdentity(user({ email: undefined, app_metadata: {} }))).toEqual({
      provider: "email",
      title: "Email account",
      detail: null,
      usesPrivateRelay: false,
    });
  });
});
