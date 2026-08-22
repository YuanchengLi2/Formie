import {
  allowedCorsHeaders,
  constantTimeEqual,
  requestIdentifier,
  withRequestIdentifier,
  validateRequestSecurity,
} from "./request-security";

describe("shared edge request security", () => {
  it.each([
    "https://useformie.com",
    "https://www.useformie.com",
    "https://dashboard.useformie.app",
  ])("reflects an approved browser origin %s", (origin) => {
    expect(allowedCorsHeaders(new Request("https://edge.test", { headers: { Origin: origin } }))).toMatchObject({
      "Access-Control-Allow-Origin": origin,
      Vary: "Origin",
    });
  });

  it("does not grant CORS to an unapproved origin", () => {
    expect(allowedCorsHeaders(new Request("https://edge.test", { headers: { Origin: "https://evil.example" } }))).not.toHaveProperty("Access-Control-Allow-Origin");
  });

  it("permits originless native JSON only with bearer authentication", async () => {
    await expect(validateRequestSecurity(new Request("https://edge.test", {
      method: "POST",
      headers: { Authorization: "Bearer token", "Content-Type": "application/json" },
      body: "{}",
    }), { methods: ["POST"], authentication: "user", maxBodyBytes: 128 })).resolves.toBeNull();

    await expect(validateRequestSecurity(new Request("https://edge.test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    }), { methods: ["POST"], authentication: "user", maxBodyBytes: 128 })).resolves.toMatchObject({ status: 401 });
  });

  it("rejects unapproved origins, methods, media types, and oversized bodies", async () => {
    const policy = { methods: ["POST"] as const, authentication: "user" as const, maxBodyBytes: 4 };
    await expect(validateRequestSecurity(new Request("https://edge.test", { method: "POST", headers: { Origin: "https://evil.example", Authorization: "Bearer token", "Content-Type": "application/json" }, body: "{}" }), policy)).resolves.toMatchObject({ status: 403 });
    await expect(validateRequestSecurity(new Request("https://edge.test", { method: "GET", headers: { Authorization: "Bearer token" } }), policy)).resolves.toMatchObject({ status: 405 });
    await expect(validateRequestSecurity(new Request("https://edge.test", { method: "POST", headers: { Authorization: "Bearer token", "Content-Type": "text/plain" }, body: "{}" }), policy)).resolves.toMatchObject({ status: 415 });
    await expect(validateRequestSecurity(new Request("https://edge.test", { method: "POST", headers: { Authorization: "Bearer token", "Content-Type": "application/json" }, body: "12345" }), policy)).resolves.toMatchObject({ status: 413 });
  });

  it("keeps scheduled and webhook endpoints unavailable to browsers", async () => {
    await expect(validateRequestSecurity(new Request("https://edge.test", {
      method: "POST",
      headers: { Origin: "https://useformie.com", Authorization: "Bearer token", "Content-Type": "application/json" },
      body: "{}",
    }), { methods: ["POST"], authentication: "webhook", allowBrowserOrigin: false })).resolves.toMatchObject({ status: 403 });
  });

  it("compares secrets without returning early on matching prefixes", () => {
    expect(constantTimeEqual("same-secret", "same-secret")).toBe(true);
    expect(constantTimeEqual("same-secret", "same-secrex")).toBe(false);
    expect(constantTimeEqual("short", "longer")).toBe(false);
  });

  it("preserves valid request identifiers and generates safe correlation ids", () => {
    const supplied = new Request("https://edge.test", { headers: { "x-request-id": "request_12345678" } });
    expect(requestIdentifier(supplied)).toBe("request_12345678");
    const generated = requestIdentifier(new Request("https://edge.test", { headers: { "x-request-id": "bad value" } }));
    expect(generated).toMatch(/^[0-9a-f-]{36}$/i);
    expect(withRequestIdentifier(supplied, new Response(null)).headers.get("x-request-id")).toBe("request_12345678");
  });
});
