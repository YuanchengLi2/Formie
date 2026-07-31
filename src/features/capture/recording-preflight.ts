import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import { getThumbnailAsync } from "expo-video-thumbnails";

import {
  checkRecordingPreflight,
  RECORDING_PREFLIGHT_FRAME_COUNT,
  type RecordingPreflightFrame,
  type RecordingPreflightResult as ApiRecordingPreflightResult,
} from "@/features/analysis/api";

import type { RecordedSet } from "./types";

const MAX_FRAME_DIMENSION = 384;
const FRAME_BATCH_SIZE = 4;

type FrameDependencies = {
  getThumbnail: (
    uri: string,
    options: { time: number; quality: number },
  ) => Promise<{ uri: string; width: number; height: number }>;
  compressFrame: (
    uri: string,
    resize: { width?: number; height?: number },
  ) => Promise<{ base64?: string | null; width: number; height: number }>;
};

const defaultFrameDependencies: FrameDependencies = {
  getThumbnail: (uri, options) => getThumbnailAsync(uri, options),
  compressFrame: (uri, resize) => manipulateAsync(
    uri,
    [{ resize }],
    { base64: true, compress: 0.45, format: SaveFormat.JPEG },
  ),
};

function frameTimes(durationMs: number): number[] {
  return Array.from(
    { length: RECORDING_PREFLIGHT_FRAME_COUNT },
    (_, index) => Math.min(
      Math.max(0, Math.round(durationMs * ((index + 0.5) / RECORDING_PREFLIGHT_FRAME_COUNT))),
      Math.max(0, durationMs - 1),
    ),
  );
}

export async function createRecordingPreflightFrames(
  recording: RecordedSet,
  dependencies: FrameDependencies = defaultFrameDependencies,
  signal?: AbortSignal,
): Promise<RecordingPreflightFrame[]> {
  const frames: RecordingPreflightFrame[] = [];
  const times = frameTimes(recording.durationMs);
  for (let batchStart = 0; batchStart < times.length; batchStart += FRAME_BATCH_SIZE) {
    if (signal?.aborted) throw new DOMException("Recording check cancelled", "AbortError");
    const batch = times.slice(batchStart, batchStart + FRAME_BATCH_SIZE);
    const prepared = await Promise.all(batch.map(async (timeMs) => {
      const thumbnail = await dependencies.getThumbnail(recording.localUri, { time: timeMs, quality: 0.5 });
      const resize = thumbnail.width >= thumbnail.height
        ? { width: MAX_FRAME_DIMENSION }
        : { height: MAX_FRAME_DIMENSION };
      const compressed = await dependencies.compressFrame(thumbnail.uri, resize);
      if (!compressed.base64) throw new Error("A recording check frame could not be prepared.");
      return { timeMs, mimeType: "image/jpeg" as const, data: compressed.base64 };
    }));
    frames.push(...prepared);
  }
  return frames;
}

export async function runRecordingPreflight(
  recording: RecordedSet,
  input: {
    accessToken: string;
    baseUrl?: string;
    signal?: AbortSignal;
    exerciseName?: string | null;
    catalogExerciseId?: number | null;
  },
): Promise<ApiRecordingPreflightResult> {
  const frames = await createRecordingPreflightFrames(recording, defaultFrameDependencies, input.signal);
  return checkRecordingPreflight({
    accessToken: input.accessToken,
    baseUrl: input.baseUrl,
    frames,
    durationMs: recording.durationMs,
    exerciseName: input.exerciseName ?? null,
    catalogExerciseId: input.catalogExerciseId ?? null,
    signal: input.signal,
  });
}
