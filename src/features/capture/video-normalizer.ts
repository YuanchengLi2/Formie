import { requireOptionalNativeModule } from "expo";
import { File } from "expo-file-system";

import type { RecordedSet } from "./types";

type NativeVideoNormalizer = {
  normalizeVideoAsync(localUri: string): Promise<string>;
  prepareVideoAsync?(localUri: string): Promise<string>;
  normalizePrivacySafeUpperBodyAsync?(localUri: string): Promise<string>;
};

export type PreparedAnalysisVideo = RecordedSet & {
  mimeType: "video/mp4";
  byteLength: number;
  normalizationApplied: boolean;
};

export function createVideoNormalizer(nativeModule: NativeVideoNormalizer | null) {
  const prepare = async (recording: RecordedSet): Promise<PreparedAnalysisVideo> => {
    const localUri = nativeModule?.prepareVideoAsync
      ? await nativeModule.prepareVideoAsync(recording.localUri)
      : recording.localUri;
    if (!localUri) throw new Error("The analysis video preparer returned no video.");
    const info = new File(localUri).info();
    const byteLength = typeof info.size === "number" ? info.size : recording.byteLength;
    if (typeof byteLength !== "number" || !Number.isInteger(byteLength) || byteLength <= 0) {
      throw new Error("The prepared analysis video size could not be determined.");
    }
    return {
      ...recording,
      localUri,
      mimeType: "video/mp4",
      byteLength,
      normalizationApplied: localUri !== recording.localUri,
    };
  };
  const normalize = async (recording: RecordedSet): Promise<RecordedSet> => {
    if (!nativeModule) {
      throw new Error("This development client does not include the full-video orientation normalizer.");
    }
    const localUri = await nativeModule.normalizeVideoAsync(recording.localUri);
    if (!localUri) throw new Error("The full-video orientation normalizer returned no video.");
    return { ...recording, localUri, mimeType: "video/mp4" };
  };
  return Object.assign(normalize, {
    prepare,
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
