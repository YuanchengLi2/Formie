import {
  AI_PROCESSING_NOTICE_SHA256,
  AI_PROCESSING_NOTICE_VERSION,
  acceptAiProcessingConsent,
  currentAiProcessingConsent,
  revokeAiProcessingConsent,
} from "./ai-consent";

const rpc = jest.fn();
const client = { rpc };

describe("AI processing consent", () => {
  beforeEach(() => rpc.mockReset());

  it("loads the current consent and normalizes a composite RPC row", async () => {
    rpc.mockResolvedValue({
      data: [{
        version: AI_PROCESSING_NOTICE_VERSION,
        notice_sha256: AI_PROCESSING_NOTICE_SHA256,
        accepted_at: "2026-09-01T12:00:00.000Z",
        revoked_at: null,
      }],
      error: null,
    });

    await expect(currentAiProcessingConsent(client)).resolves.toEqual({
      version: AI_PROCESSING_NOTICE_VERSION,
      noticeSha256: AI_PROCESSING_NOTICE_SHA256,
      acceptedAt: "2026-09-01T12:00:00.000Z",
      revokedAt: null,
    });
    expect(rpc).toHaveBeenCalledWith("current_ai_processing_consent");
  });

  it("records the source-controlled notice version and digest", async () => {
    rpc.mockResolvedValue({ data: null, error: null });

    await expect(acceptAiProcessingConsent(client)).resolves.toBeUndefined();
    expect(rpc).toHaveBeenCalledWith("record_ai_processing_consent", {
      p_version: AI_PROCESSING_NOTICE_VERSION,
      p_notice_sha256: AI_PROCESSING_NOTICE_SHA256,
    });
  });

  it("revokes future processing and surfaces RPC failures", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: null });
    await expect(revokeAiProcessingConsent(client)).resolves.toBeUndefined();
    expect(rpc).toHaveBeenCalledWith("revoke_ai_processing_consent", {
      p_version: AI_PROCESSING_NOTICE_VERSION,
    });

    rpc.mockResolvedValueOnce({ data: null, error: { message: "network unavailable" } });
    await expect(acceptAiProcessingConsent(client)).rejects.toThrow("network unavailable");
  });
});
