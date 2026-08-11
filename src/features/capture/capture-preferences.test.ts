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
    await saveCapturePreferences({ countdownSeconds: 15, recordingVibrationEnabled: false, interactionHapticsEnabled: true });
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      "form.capture-preferences.v2",
      JSON.stringify({ countdownSeconds: 15, recordingVibrationEnabled: false, interactionHapticsEnabled: true }),
    );
  });

  it("migrates the v1 haptics selection into both independent switches", async () => {
    (SecureStore.getItemAsync as jest.Mock)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(JSON.stringify({ countdownSeconds: 5, hapticsEnabled: false }));
    await expect(loadCapturePreferences()).resolves.toEqual({ countdownSeconds: 5, recordingVibrationEnabled: false, interactionHapticsEnabled: false });
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith("form.capture-preferences.v2", JSON.stringify({ countdownSeconds: 5, recordingVibrationEnabled: false, interactionHapticsEnabled: false }));
  });

  it("falls back when stored values are malformed", async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce(JSON.stringify({ countdownSeconds: 9, hapticsEnabled: "yes" }));
    await expect(loadCapturePreferences()).resolves.toEqual(defaultCapturePreferences);
  });
});
