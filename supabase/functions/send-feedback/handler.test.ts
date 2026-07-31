import { createSendFeedbackHandler, type SendFeedbackDependencies } from "./handler";

const requestId = "998e1d02-b1cf-4f90-b497-896c53d83dcf";
const validBody = {
  clientRequestId: requestId,
  category: "feature_request",
  message: "Please add comparison overlays for two saved sets.",
  diagnostics: {
    appVersion: "1.0.0",
    build: "42",
    platform: "ios",
    osVersion: "18.5",
  },
};

function dependencies(overrides: Partial<SendFeedbackDependencies> = {}): SendFeedbackDependencies {
  return {
    authenticate: jest.fn(async () => ({ id: "user-123", email: "athlete@example.com" })),
    sendEmail: jest.fn(async () => ({ id: "email-456" })),
    ...overrides,
  };
}

describe("send feedback handler", () => {
  it("requires an authenticated user with a reply email", async () => {
    const response = await createSendFeedbackHandler(
      new Request("https://example.test", {
        method: "POST",
        body: JSON.stringify(validBody),
      }),
      dependencies({ authenticate: jest.fn(async () => { throw new Error("UNAUTHORIZED"); }) }),
    );

    expect(response.status).toBe(401);
  });

  it.each([
    ["short message", { ...validBody, message: "Too short" }],
    ["long message", { ...validBody, message: "x".repeat(2001) }],
    ["unknown category", { ...validBody, category: "billing" }],
    ["extra diagnostics", { ...validBody, diagnostics: { ...validBody.diagnostics, deviceId: "secret" } }],
  ])("rejects %s", async (_label, body) => {
    const deps = dependencies();
    const response = await createSendFeedbackHandler(
      new Request("https://example.test", { method: "POST", body: JSON.stringify(body) }),
      deps,
    );

    expect(response.status).toBe(400);
    expect(deps.sendEmail).not.toHaveBeenCalled();
  });

  it("escapes user content, includes only approved diagnostics, and uses the request id for idempotency", async () => {
    const deps = dependencies();
    const response = await createSendFeedbackHandler(
      new Request("https://example.test", {
        method: "POST",
        body: JSON.stringify({
          ...validBody,
          message: "<script>alert('x')</script> Please fix this issue.",
        }),
      }),
      deps,
    );

    expect(response.status).toBe(200);
    expect(deps.sendEmail).toHaveBeenCalledWith(expect.objectContaining({
      idempotencyKey: requestId,
      replyTo: "athlete@example.com",
      subject: "[Formie Feature Request] athlete@example.com",
      text: expect.stringContaining("<script>alert('x')</script>"),
      html: expect.not.stringContaining("<script>"),
    }));
    expect(deps.sendEmail).toHaveBeenCalledWith(expect.objectContaining({
      html: expect.stringContaining("&lt;script&gt;"),
      text: expect.stringContaining("App version: 1.0.0"),
    }));
    await expect(response.json()).resolves.toEqual({ submitted: true, requestId });
  });

  it("returns a retryable error when Resend rejects the message", async () => {
    const response = await createSendFeedbackHandler(
      new Request("https://example.test", {
        method: "POST",
        body: JSON.stringify(validBody),
      }),
      dependencies({ sendEmail: jest.fn(async () => { throw new Error("resend unavailable"); }) }),
    );

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toMatchObject({
      code: "EMAIL_DELIVERY_FAILED",
    });
  });
});
