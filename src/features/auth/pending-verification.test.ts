/* eslint-disable import/first */
const mockGetItemAsync = jest.fn();
const mockSetItemAsync = jest.fn();
const mockDeleteItemAsync = jest.fn();

jest.mock("expo-secure-store", () => ({
  getItemAsync: (...args: unknown[]) => mockGetItemAsync(...args),
  setItemAsync: (...args: unknown[]) => mockSetItemAsync(...args),
  deleteItemAsync: (...args: unknown[]) => mockDeleteItemAsync(...args),
}));

import { clearPendingVerification, loadPendingVerification, savePendingVerification } from "./pending-verification";

describe("pending verification storage", () => {
  beforeEach(() => {
    mockGetItemAsync.mockReset();
    mockSetItemAsync.mockReset();
    mockDeleteItemAsync.mockReset();
  });

  it("persists only normalized email and verification type", async () => {
    await savePendingVerification({ email: " USER@Example.COM ", type: "signup" });
    expect(mockSetItemAsync).toHaveBeenCalledWith(
      "form.auth.pending-verification.v1",
      JSON.stringify({ email: "user@example.com", type: "signup" }),
    );
  });

  it("loads valid state and discards malformed state", async () => {
    mockGetItemAsync.mockResolvedValueOnce(JSON.stringify({ email: "user@example.com", type: "email_change" }));
    await expect(loadPendingVerification()).resolves.toEqual({ email: "user@example.com", type: "email_change" });

    mockGetItemAsync.mockResolvedValueOnce("{bad-json");
    await expect(loadPendingVerification()).resolves.toBeNull();
    expect(mockDeleteItemAsync).toHaveBeenCalledWith("form.auth.pending-verification.v1");
  });

  it("restores password-recovery code state", async () => {
    mockGetItemAsync.mockResolvedValueOnce(JSON.stringify({ email: "user@example.com", type: "recovery" }));
    await expect(loadPendingVerification()).resolves.toEqual({ email: "user@example.com", type: "recovery" });
  });

  it("clears verification state", async () => {
    await clearPendingVerification();
    expect(mockDeleteItemAsync).toHaveBeenCalledWith("form.auth.pending-verification.v1");
  });
});
