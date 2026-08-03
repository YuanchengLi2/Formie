// Cleanup-only paths for artifacts produced by pre-v46 sessions. The current
// pipeline never requests, uploads, or serves these files.
export function historicalAnalysisArtifactPaths(userId: string, sessionId: string): string[] {
  return Array.from(
    { length: 25 },
    (_, index) => `${userId}/${sessionId}/exact-frames/${String(index).padStart(2, "0")}.jpg`,
  );
}
