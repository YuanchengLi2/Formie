import * as SecureStore from "expo-secure-store";
import { create } from "zustand";

import type { CaptureCountdownSeconds } from "./types";

const STORAGE_KEY = "form.capture-preferences.v2";
const LEGACY_STORAGE_KEY = "form.capture-preferences.v1";

export type CapturePreferences = {
  countdownSeconds: CaptureCountdownSeconds;
  recordingVibrationEnabled: boolean;
  interactionHapticsEnabled: boolean;
};

export const defaultCapturePreferences: CapturePreferences = {
  countdownSeconds: 10,
  recordingVibrationEnabled: true,
  interactionHapticsEnabled: true,
};

function isCapturePreferences(value: unknown): value is CapturePreferences {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<CapturePreferences>;
  return (
    (candidate.countdownSeconds === 5 || candidate.countdownSeconds === 10 || candidate.countdownSeconds === 15)
    && typeof candidate.recordingVibrationEnabled === "boolean"
    && typeof candidate.interactionHapticsEnabled === "boolean"
  );
}

function migrateLegacyPreferences(value: unknown): CapturePreferences | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as { countdownSeconds?: unknown; hapticsEnabled?: unknown };
  if ((candidate.countdownSeconds !== 5 && candidate.countdownSeconds !== 10 && candidate.countdownSeconds !== 15) || typeof candidate.hapticsEnabled !== "boolean") return null;
  return { countdownSeconds: candidate.countdownSeconds, recordingVibrationEnabled: candidate.hapticsEnabled, interactionHapticsEnabled: candidate.hapticsEnabled };
}

export async function loadCapturePreferences(): Promise<CapturePreferences> {
  try {
    const raw = process.env.EXPO_OS === "web"
      ? globalThis.localStorage?.getItem(STORAGE_KEY) ?? null
      : await SecureStore.getItemAsync(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (isCapturePreferences(parsed)) return parsed;
    const legacyRaw = process.env.EXPO_OS === "web"
      ? globalThis.localStorage?.getItem(LEGACY_STORAGE_KEY) ?? null
      : await SecureStore.getItemAsync(LEGACY_STORAGE_KEY);
    const migrated = migrateLegacyPreferences(legacyRaw ? JSON.parse(legacyRaw) : null);
    if (!migrated) return defaultCapturePreferences;
    await saveCapturePreferences(migrated);
    return migrated;
  } catch {
    return defaultCapturePreferences;
  }
}

export async function saveCapturePreferences(preferences: CapturePreferences): Promise<void> {
  if (!isCapturePreferences(preferences)) throw new Error("Unsupported capture preferences");
  const serialized = JSON.stringify(preferences);
  if (process.env.EXPO_OS === "web") {
    globalThis.localStorage?.setItem(STORAGE_KEY, serialized);
    return;
  }
  await SecureStore.setItemAsync(STORAGE_KEY, serialized);
}

type CapturePreferencesStore = {
  preferences: CapturePreferences;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  update: (patch: Partial<CapturePreferences>) => Promise<void>;
};

export const useCapturePreferences = create<CapturePreferencesStore>((set, get) => ({
  preferences: defaultCapturePreferences,
  hydrated: false,
  async hydrate() {
    if (get().hydrated) return;
    const preferences = await loadCapturePreferences();
    set({ preferences, hydrated: true });
  },
  async update(patch) {
    const preferences = { ...get().preferences, ...patch };
    await saveCapturePreferences(preferences);
    set({ preferences, hydrated: true });
  },
}));
