import { createAppleAuthorizationReceipt, openAppleAuthorizationReceipt } from "./apple-authorization-receipt";

describe("Apple authorization receipt", () => {
  const key = Uint8Array.from({ length: 32 }, (_, index) => index);
  const now = new Date("2026-09-02T12:00:00.000Z");

  it("round-trips short-lived token custody without exposing the refresh token", async () => {
    const receipt = await createAppleAuthorizationReceipt({ refreshToken: "refresh-token", subject: "apple-subject" }, key, now);

    expect(receipt).not.toContain("refresh-token");
    await expect(openAppleAuthorizationReceipt(receipt, key, now)).resolves.toEqual({
      refreshToken: "refresh-token",
      subject: "apple-subject",
    });
  });

  it("rejects an expired receipt", async () => {
    const receipt = await createAppleAuthorizationReceipt({ refreshToken: "refresh-token", subject: "apple-subject" }, key, now);
    const later = new Date(now.getTime() + 6 * 60 * 1000);

    await expect(openAppleAuthorizationReceipt(receipt, key, later)).rejects.toThrow("APPLE_AUTHORIZATION_RECEIPT_EXPIRED");
  });
});
