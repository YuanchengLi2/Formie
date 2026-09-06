import { referralContextHandler } from "./handler";

const token = "a".repeat(43);

function dependencies(overrides: Partial<Parameters<typeof referralContextHandler>[1]> = {}): Parameters<typeof referralContextHandler>[1] {
  return {
    authenticate: async () => "user-1",
    hashToken: async () => "hash",
    createToken: () => "z".repeat(43),
    issueCode: async () => [],
    preview: async () => [{ visit_id: "visit-1", creator_display_name: "Alex", issued_at: "2026-09-01T00:00:00Z", expires_at: "2026-10-01T00:00:00Z", eligible: true }],
    claim: async () => [{ creator_display_name: "Alex", attributed_at: "2026-09-04T00:00:00Z", already_claimed: false }],
    status: async () => null,
    finalize: async () => ({ profile: { user_id: "user-1", onboarding_completed: true }, referral: { state: "none" } }),
    ...overrides,
  };
}

function post(body: Record<string, unknown>) {
  return new Request("https://example.test/referral-context", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}

describe("referralContextHandler", () => {
  it("issues an opaque referral claim after validating a creator code", async () => {
    const issueCode = jest.fn(async () => [{
      visit_id: "visit-code-1",
      creator_display_name: "Alex",
      issued_at: "2026-09-05T12:00:00Z",
      expires_at: "2026-10-05T12:00:00Z",
      eligible: true,
    }]);
    const response = await referralContextHandler(
      post({ action: "code_preview", code: "  ALEX-7Q2K  " }),
      {
        ...dependencies(),
        createToken: () => "z".repeat(43),
        issueCode,
      } as never,
    );

    expect(response.status).toBe(200);
    expect(issueCode).toHaveBeenCalledWith({ code: "alex-7q2k", tokenHash: "hash" });
    await expect(response.json()).resolves.toEqual({ referral: {
      token: "z".repeat(43),
      visitId: "visit-code-1",
      creatorCode: "ALEX-7Q2K",
      creatorDisplayName: "Alex",
      issuedAt: "2026-09-05T12:00:00Z",
      expiresAt: "2026-10-05T12:00:00Z",
      eligible: true,
    } });
  });

  it("rejects malformed creator codes without issuing a claim", async () => {
    const issueCode = jest.fn();
    const response = await referralContextHandler(
      post({ action: "code_preview", code: "!" }),
      { ...dependencies(), createToken: () => "z".repeat(43), issueCode } as never,
    );

    expect(response.status).toBe(400);
    expect(issueCode).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toEqual({ code: "INVALID_CREATOR_CODE" });
  });

  it("returns only server-derived referral preview fields", async () => {
    const response = await referralContextHandler(post({ action: "preview", token }), dependencies());
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ referral: { visitId: "visit-1", creatorDisplayName: "Alex", issuedAt: "2026-09-01T00:00:00Z", expiresAt: "2026-10-01T00:00:00Z", eligible: true } });
  });

  it("requires authentication for claim", async () => {
    const response = await referralContextHandler(post({ action: "claim", token }), dependencies({ authenticate: async () => { throw new Error("UNAUTHORIZED"); } }));
    expect(response.status).toBe(401);
  });

  it("rejects legacy link attribution during onboarding finalization", async () => {
    const finalize = jest.fn(async () => ({ profile: { user_id: "user-1", onboarding_completed: true }, referral: { state: "attributed" } }));
    const response = await referralContextHandler(post({ action: "finalize", token, method: "direct_link", profile: { ageYears: 25 }, acquisition: { source: "youtube" } }), dependencies({ finalize }));
    expect(response.status).toBe(400);
    expect(finalize).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toEqual({ code: "INVALID_REFERRAL_METHOD" });
  });

  it("rejects claims that do not identify the creator-code method", async () => {
    const claim = jest.fn();
    const response = await referralContextHandler(post({ action: "claim", token, method: "nativelink" }), dependencies({ claim }));
    expect(response.status).toBe(400);
    expect(claim).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toEqual({ code: "INVALID_REFERRAL_METHOD" });
  });

  it("preserves creator-code attribution through onboarding finalization", async () => {
    const finalize = jest.fn(async () => ({ profile: { user_id: "user-1", onboarding_completed: true }, referral: { state: "attributed" } }));
    const response = await referralContextHandler(post({ action: "finalize", token, method: "creator_code", profile: { ageYears: 25 }, acquisition: { source: "affiliated_creator" } }), dependencies({ finalize }));
    expect(response.status).toBe(200);
    expect(finalize).toHaveBeenCalledWith({ userId: "user-1", tokenHash: "hash", method: "creator_code", profile: { ageYears: 25 }, acquisition: { source: "affiliated_creator" } });
  });

  it("rejects malformed referral tokens before finalization", async () => {
    const finalize = jest.fn();
    const response = await referralContextHandler(post({ action: "finalize", token: "creator-code", profile: {}, acquisition: {} }), dependencies({ finalize }));
    expect(response.status).toBe(400);
    expect(finalize).not.toHaveBeenCalled();
  });
});
