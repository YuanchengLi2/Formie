import { decryptSecretEnvelope, encryptSecretEnvelope } from "./secret-envelope";

const key = Uint8Array.from({ length: 32 }, (_, index) => index);

describe("secret envelope", () => {
  it("round-trips provider secrets without embedding plaintext", async () => {
    const encrypted = await encryptSecretEnvelope("refresh-token-secret", key);

    expect(encrypted).toMatch(/^v1\./);
    expect(encrypted).not.toContain("refresh-token-secret");
    await expect(decryptSecretEnvelope(encrypted, key)).resolves.toBe("refresh-token-secret");
  });

  it("rejects a modified authenticated ciphertext", async () => {
    const encrypted = await encryptSecretEnvelope("refresh-token-secret", key);
    const tampered = encrypted.slice(0, -1) + (encrypted.endsWith("A") ? "B" : "A");

    await expect(decryptSecretEnvelope(tampered, key)).rejects.toThrow();
  });
});
