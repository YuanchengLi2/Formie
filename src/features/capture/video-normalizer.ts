import { requireOptionalNativeModule } from "expo";

import type { RecordedSet } from "./types";

type NativeVideoNormalizer = {
  normalizeVideoAsync(localUri: string): Promise<string>;
  normalizePrivacySafeUpperBodyAsync?(localUri: string): Promise<string>;
};

export function createVideoNormalizer(nativeModule: NativeVideoNormalizer | null) {
  const normalize = async (recording: RecordedSet): Promise<RecordedSet> => {
    if (!nativeModule) {
      throw new Error("This development client does not include the full-video orientation normalizer.");
    }
    const localUri = await nativeModule.normalizeVideoAsync(recording.localUri);
    if (!localUri) throw new Error("The full-video orientation normalizer returned no video.");
    return { ...recording, localUri, mimeType: "video/mp4" };
  };
  return Object.assign(normalize, {
    supportsPrivacySafeFallback: typeof nativeModule?.normalizePrivacySafeUpperBodyAsync === "function",
    privacySafeUpperBody: async (recording: RecordedSet): Promise<RecordedSet> => {
      if (!nativeModule?.normalizePrivacySafeUpperBodyAsync) {
        throw new Error("This development client does not include privacy-safe video export.");
      }
      const localUri = await nativeModule.normalizePrivacySafeUpperBodyAsync(recording.localUri);
      if (!localUri) throw new Error("The privacy-safe video exporter returned no video.");
      return { ...recording, localUri, mimeType: "video/mp4" };
    },
  });
}

export const normalizeVideoForAnalysis = createVideoNormalizer(
  requireOptionalNativeModule<NativeVideoNormalizer>("FormVideoNormalizer"),
);
