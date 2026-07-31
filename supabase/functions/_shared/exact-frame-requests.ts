export type ExactFrameRequest = {
  requestId: string;
  findingId: string;
  peakMs: number;
  timestampsMs: [number, number, number, number, number];
};

export type ExactFrameManifestItem = {
  requestId: string;
  findingId: string;
  evidenceId: string;
  timestampMs: number;
  path: string;
};

export const EXACT_FRAME_UPLOAD_CAPACITY = 25;

export function exactFrameUploadPaths(userId: string, sessionId: string): string[] {
  return Array.from(
    { length: EXACT_FRAME_UPLOAD_CAPACITY },
    (_, index) => `${userId}/${sessionId}/exact-frames/${String(index).padStart(2, "0")}.jpg`,
  );
}
