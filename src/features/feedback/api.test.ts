import { sendFeedback } from "./api";

describe("sendFeedback", () => {
  const input = {
    accessToken: "user-jwt",
    apiKey: "public-key",
    baseUrl: "https://example.supabase.co/functions/v1",
    clientRequestId: "998e1d02-b1cf-4f90-b497-896c53d83dcf",
    category: "bug" as const,
    message: "The result screen stays blank after processing.",
    diagnostics: {
      appVersion: "1.0.0",
      build: "42",
      platform: "ios" as const,
      osVersion: "18.5",
    },
  };

  it("sends the authenticated, privacy-limited feedback contract", async () => {
    const fetcher = jest.fn(async () => new Response(JSON.stringify({
      submitted: true,
      requestId: input.clientRequestId,
    }), { status: 200, headers: { "Content-Type": "application/json" } }));

    await expect(sendFeedback({ ...input, fetcher })).resolves.toEqual({
      submitted: true,
      requestId: input.clientRequestId,
    });

    expect(fetcher).toHaveBeenCalledWith(
      "https://example.supabase.co/functions/v1/send-feedback",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer user-jwt",
          apikey: "public-key",
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({
          clientRequestId: input.clientRequestId,
          category: "bug",
          message: input.message,
          diagnostics: input.diagnostics,
        }),
      }),
    );
  });

  it("surfaces a retryable provider failure", async () => {
    const fetcher = jest.fn(async () => new Response(JSON.stringify({
      code: "EMAIL_DELIVERY_FAILED",
      message: "Feedback could not be sent. Try again.",
    }), { status: 502, headers: { "Content-Type": "application/json" } }));

    await expect(sendFeedback({ ...input, fetcher })).rejects.toMatchObject({
      code: "EMAIL_DELIVERY_FAILED",
      status: 502,
    });
  });

  it("rejects an invalid response instead of reporting success", async () => {
    const fetcher = jest.fn(async () => new Response(JSON.stringify({ submitted: false }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }));

    await expect(sendFeedback({ ...input, fetcher })).rejects.toMatchObject({
      code: "INVALID_RESPONSE",
    });
  });
});
