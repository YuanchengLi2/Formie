import { createSendSupportHandler, type SendSupportDependencies } from "./handler";

const validBody = {
  name: "Jamie",
  email: "jamie@example.com",
  category: "account",
  message: "I need help updating the email on my Formie account.",
  website: "",
};

function request(body: unknown = validBody, token = "internal-token") {
  return new Request("https://example.test/send-support", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-Formie-Client-IP": "198.51.100.8",
    },
    body: JSON.stringify(body),
  });
}

function dependencies(overrides: Partial<SendSupportDependencies> = {}): SendSupportDependencies {
  return {
    authenticateInternalRequest: jest.fn(() => true),
    createRequestId: jest.fn(() => "support-request-id"),
    hashIdentifier: jest.fn(async (kind, value) => `${kind}:${value}`),
    reserveRequest: jest.fn(async () => ({ allowed: true as const })),
    updateRequestStatus: jest.fn(async () => undefined),
    sendEmail: jest.fn(async () => ({ id: "resend-id" })),
    ...overrides,
  };
}

describe("send support handler", () => {
  it("rejects requests without the internal server token", async () => {
    const deps = dependencies({ authenticateInternalRequest: jest.fn(() => false) });
    const response = await createSendSupportHandler(request(), deps);
    expect(response.status).toBe(401);
    expect(deps.sendEmail).not.toHaveBeenCalled();
  });

  it.each([
    ["honeypot", { ...validBody, website: "https://spam.example" }],
    ["short message", { ...validBody, message: "Too short" }],
    ["extra browser IP", { ...validBody, ip: "203.0.113.5" }],
  ])("rejects invalid %s input", async (_label, body) => {
    const deps = dependencies();
    const response = await createSendSupportHandler(request(body), deps);
    expect(response.status).toBe(400);
    expect(deps.sendEmail).not.toHaveBeenCalled();
  });

  it.each([
    ["IP hourly limit", "ip"],
    ["email daily limit", "email"],
  ])("enforces the %s", async (_label, limit) => {
    const deps = dependencies({
      reserveRequest: jest.fn(async () => ({ allowed: false as const, limit })),
    });
    const response = await createSendSupportHandler(request(), deps);
    expect(response.status).toBe(429);
    expect(deps.sendEmail).not.toHaveBeenCalled();
  });

  it("escapes HTML, sends to Resend, and records a successful request", async () => {
    const deps = dependencies();
    const response = await createSendSupportHandler(
      request({ ...validBody, message: "<script>alert('x')</script> Please help with my account." }),
      deps,
    );

    expect(response.status).toBe(200);
    expect(deps.hashIdentifier).toHaveBeenCalledWith("ip", "198.51.100.8");
    expect(deps.hashIdentifier).toHaveBeenCalledWith("email", "jamie@example.com");
    expect(deps.sendEmail).toHaveBeenCalledWith(expect.objectContaining({
      idempotencyKey: "support-request-id",
      replyTo: "jamie@example.com",
      html: expect.not.stringContaining("<script>"),
    }));
    expect(deps.sendEmail).toHaveBeenCalledWith(expect.objectContaining({
      html: expect.stringContaining("&lt;script&gt;"),
    }));
    expect(deps.updateRequestStatus).toHaveBeenLastCalledWith(expect.objectContaining({
      requestId: "support-request-id",
      status: "sent",
    }));
    await expect(response.json()).resolves.toEqual({ submitted: true, requestId: "support-request-id" });
  });

  it("records and reports a Resend failure", async () => {
    const deps = dependencies({
      sendEmail: jest.fn(async () => {
        throw new Error("resend unavailable");
      }),
    });
    const response = await createSendSupportHandler(request(), deps);
    expect(response.status).toBe(502);
    expect(deps.updateRequestStatus).toHaveBeenLastCalledWith(expect.objectContaining({ status: "failed" }));
  });
});
