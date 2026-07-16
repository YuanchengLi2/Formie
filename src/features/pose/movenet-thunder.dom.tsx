"use dom";

import { useEffect } from "react";
import * as poseDetection from "@tensorflow-models/pose-detection";
import * as tf from "@tensorflow/tfjs";
import "@tensorflow/tfjs-backend-webgl";

type FrameInput = { timeMs: number; dataUri: string };
type PoseFrame = { timeMs: number; keypoints: { name: string; x: number; y: number; score: number }[] };

let detectorPromise: Promise<poseDetection.PoseDetector> | null = null;

async function detector(): Promise<poseDetection.PoseDetector> {
  if (!detectorPromise) {
    detectorPromise = (async () => {
      await tf.setBackend("webgl");
      await tf.ready();
      return poseDetection.createDetector(poseDetection.SupportedModels.MoveNet, {
        modelType: poseDetection.movenet.modelType.SINGLEPOSE_THUNDER,
        enableSmoothing: true,
      });
    })();
  }
  return detectorPromise;
}

async function loadImage(source: string): Promise<HTMLImageElement> {
  const image = new Image();
  const loaded = new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("Pose frame could not be decoded"));
  });
  image.src = source;
  if (typeof image.decode === "function") await image.decode();
  else await loaded;
  return image;
}

export default function MoveNetThunderDom({
  jobId,
  frames,
  onResult,
  onFailure,
}: {
  jobId: string;
  frames: FrameInput[];
  onResult: (jobId: string, frames: PoseFrame[]) => Promise<void>;
  onFailure: (jobId: string, message: string) => Promise<void>;
  dom?: import("expo/dom").DOMProps;
}) {
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const model = await detector();
        const output: PoseFrame[] = [];
        for (const frame of frames) {
          if (cancelled) return;
          const image = await loadImage(frame.dataUri);
          const poses = await model.estimatePoses(image, { flipHorizontal: false });
          const pose = poses[0];
          if (!pose) continue;
          output.push({
            timeMs: frame.timeMs,
            keypoints: pose.keypoints.flatMap((keypoint) => keypoint.name ? [{
              name: keypoint.name,
              x: keypoint.x / Math.max(1, image.naturalWidth),
              y: keypoint.y / Math.max(1, image.naturalHeight),
              score: keypoint.score ?? 0,
            }] : []),
          });
        }
        if (!cancelled) await onResult(jobId, output);
      } catch (error) {
        detectorPromise = null;
        if (!cancelled) await onFailure(jobId, error instanceof Error ? error.message : "MoveNet Thunder failed");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [frames, jobId, onFailure, onResult]);

  return <div aria-hidden="true" style={{ width: 1, height: 1, overflow: "hidden", opacity: 0 }} />;
}
