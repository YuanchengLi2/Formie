import { useCallback, useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { File } from "expo-file-system";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import * as VideoThumbnails from "expo-video-thumbnails";

import MoveNetThunderDom from "./movenet-thunder.dom";
import { buildPoseSummary, poseFrameTimestamps, type PoseSummary, type ThunderPoseFrame } from "./pose-summary";

export type PoseAnalysisJob = { id: string; localUri: string; durationMs: number };
type PreparedFrame = { timeMs: number; dataUri: string };

function removeCacheFile(uri?: string) {
  if (!uri) return;
  try {
    new File(uri).delete();
  } catch {
    // Cache cleanup must never fail the recording flow.
  }
}

async function prepareFrame(localUri: string, timeMs: number): Promise<PreparedFrame> {
  const thumbnail = await VideoThumbnails.getThumbnailAsync(localUri, { time: timeMs, quality: 0.7 });
  let resizedUri: string | undefined;
  try {
    const resized = await manipulateAsync(thumbnail.uri, [{ resize: { width: 256 } }], { base64: true, compress: 0.72, format: SaveFormat.JPEG });
    resizedUri = resized.uri;
    if (!resized.base64) throw new Error("Pose frame encoding failed");
    return { timeMs, dataUri: `data:image/jpeg;base64,${resized.base64}` };
  } finally {
    removeCacheFile(thumbnail.uri);
    removeCacheFile(resizedUri);
  }
}

export function PoseAnalysisCoordinator({ job, onComplete }: { job: PoseAnalysisJob | null; onComplete: (jobId: string, summary: PoseSummary | null) => void }) {
  const [prepared, setPrepared] = useState<{ jobId: string; frames: PreparedFrame[] } | null>(null);
  const completedJob = useRef<string | null>(null);

  useEffect(() => {
    if (!job) {
      setPrepared(null);
      return;
    }
    let cancelled = false;
    completedJob.current = null;
    void (async () => {
      try {
        const timestamps = poseFrameTimestamps(job.durationMs, { targetFps: 4, maxFrames: 96 });
        const frames: PreparedFrame[] = [];
        for (let index = 0; index < timestamps.length; index += 4) {
          const batch = await Promise.all(timestamps.slice(index, index + 4).map((timeMs) => prepareFrame(job.localUri, timeMs)));
          if (cancelled) return;
          frames.push(...batch);
        }
        if (!cancelled) setPrepared({ jobId: job.id, frames });
      } catch {
        if (!cancelled) onComplete(job.id, null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [job, onComplete]);

  const finish = useCallback((jobId: string, frames: ThunderPoseFrame[] | null) => {
    if (!job || job.id !== jobId || completedJob.current === jobId) return;
    completedJob.current = jobId;
    onComplete(jobId, frames ? buildPoseSummary(frames, job.durationMs) : null);
    setPrepared(null);
  }, [job, onComplete]);

  const handleResult = useCallback(async (jobId: string, frames: ThunderPoseFrame[]) => {
    finish(jobId, frames);
  }, [finish]);

  const handleFailure = useCallback(async (jobId: string) => {
    finish(jobId, null);
  }, [finish]);

  if (!prepared || !job || prepared.jobId !== job.id) return null;
  return (
    <View pointerEvents="none" style={{ position: "absolute", width: 2, height: 2, left: -10, bottom: -10, opacity: 0 }}>
      <MoveNetThunderDom
        jobId={job.id}
        frames={prepared.frames}
        onResult={handleResult}
        onFailure={handleFailure}
        dom={{ scrollEnabled: false, style: { width: 2, height: 2 } }}
      />
    </View>
  );
}
