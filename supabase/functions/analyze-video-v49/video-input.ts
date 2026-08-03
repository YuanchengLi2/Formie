export type V49VideoPaths = { videoPath: string | null; analysisVideoPath: string | null; analysisInputStrategy: string | null };
export type PreparedV49InlineVideo = {
  video: { kind: "inline"; data: string; mimeType: string };
  byteLength: number;
  sha256: string;
};

export function selectV49VideoPath(session: V49VideoPaths): string {
  if (["upright_video", "trimmed_crop", "capture_ready_video"].includes(session.analysisInputStrategy ?? "")) {
    if (!session.analysisVideoPath) throw new Error("Normalized analysis video path is missing");
    return session.analysisVideoPath;
  }
  if (!session.videoPath) throw new Error("Video path is missing");
  return session.videoPath;
}

function base64(bytes: Uint8Array): string {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
}

export async function prepareV49InlineVideo(blob: Blob): Promise<PreparedV49InlineVideo> {
  if (blob.size <= 0) throw new Error("Analysis video is empty");
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return {
    video: { kind: "inline", data: base64(bytes), mimeType: blob.type || "video/mp4" },
    byteLength: bytes.byteLength,
    sha256: [...digest].map((value) => value.toString(16).padStart(2, "0")).join(""),
  };
}
