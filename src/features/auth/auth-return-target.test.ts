import * as SecureStore from "expo-secure-store";

import { consumeAuthReturnTarget, setAuthReturnTarget } from "./auth-return-target";

jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

describe("auth return target", () => {
  beforeEach(() => jest.clearAllMocks());

  it("stores an opaque allowlisted subscription destination instead of an arbitrary URL", async () => {
    await setAuthReturnTarget("/subscription");
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith("formie.auth-return-target", "subscription");
    await expect(setAuthReturnTarget("https://evil.example" as never)).rejects.toThrow(/return target/i);
  });

  it("consumes the destination once after successful Apple authentication", async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue("subscription");
    await expect(consumeAuthReturnTarget()).resolves.toBe("/subscription");
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith("formie.auth-return-target");
  });
});
