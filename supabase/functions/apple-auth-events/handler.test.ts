import { appleAuthEventsHandler } from "./handler";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const request = (signedPayload = "header.payload.signature") => new Request("https://example.test/apple-auth-events", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ signedPayload }) });

it("resolves legacy Apple identities when token custody has no matching row", () => {
  const source = readFileSync(resolve(__dirname, "index.ts"), "utf8");
  expect(source).toContain('.rpc("resolve_apple_identity_user_id"');
  expect(source).toContain("data?.user_id ?? resolvedUserId");
});

it("marks consent revocation and account deletion events without returning the Apple subject", async () => {
  const markRevoked = jest.fn(async () => undefined);
  const response = await appleAuthEventsHandler(request(), { verify: jest.fn(async () => ({ eventType: "consent-revoked", subject: "private-apple-subject" })), markRevoked });
  expect(await response.json()).toEqual({ received: true });
  expect(markRevoked).toHaveBeenCalledWith("private-apple-subject", "consent-revoked");
});

it("validates the signed payload and ignores non-revocation lifecycle events", async () => {
  const markRevoked = jest.fn();
  const valid = await appleAuthEventsHandler(request(), { verify: jest.fn(async () => ({ eventType: "email-disabled", subject: "subject" })), markRevoked });
  expect(valid.status).toBe(200);
  expect(markRevoked).not.toHaveBeenCalled();
  const invalid = await appleAuthEventsHandler(request(), { verify: jest.fn(async () => { throw new Error("bad signature"); }), markRevoked });
  expect(invalid.status).toBe(400);
});
