import * as SecureStore from "expo-secure-store";

import {
  defaultCapturePreferences,
  loadCapturePreferences,
  saveCapturePreferences,
} from "./capture-preferences";

jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
}));

describe("capture preferences", () => {
  beforeEach(() => jest.clearAllMocks());

  it("defaults safely when no device preference has been saved", async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce(null);
    await expect(loadCapturePreferences()).resolves.toEqual(defaultCapturePreferences);
  });

  it("persists only supported countdown and haptic settings", async () => {
    await saveCapturePreferences({ countdownSeconds: 15, hapticsEnabled: false });
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      "form.capture-preferences.v1",
      JSON.stringify({ countdownSeconds: 15, hapticsEnabled: false }),
    );
  });

  it("falls back when stored values are malformed", async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce(JSON.stringify({ countdownSeconds: 9, hapticsEnabled: "yes" }));
    await expect(loadCapturePreferences()).resolves.toEqual(defaultCapturePreferences);
  });
});
