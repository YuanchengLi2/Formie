export type ThunderKeypoint = { name: string; x: number; y: number; score: number };
export type ThunderPoseFrame = { timeMs: number; keypoints: ThunderKeypoint[] };

export const poseSeriesColumns = [
  "timeMs", "confidence",
  "leftShoulderX", "leftShoulderY", "rightShoulderX", "rightShoulderY",
  "leftElbowX", "leftElbowY", "rightElbowX", "rightElbowY",
  "leftWristX", "leftWristY", "rightWristX", "rightWristY",
  "leftHipX", "leftHipY", "rightHipX", "rightHipY",
  "leftKneeX", "leftKneeY", "rightKneeX", "rightKneeY",
  "leftAnkleX", "leftAnkleY", "rightAnkleX", "rightAnkleY",
  "leftElbowAngle", "rightElbowAngle", "leftKneeAngle", "rightKneeAngle",
  "shoulderHeightDelta", "wristHeightDelta", "hipHeightDelta",
] as const;

export type PoseSeriesColumn = typeof poseSeriesColumns[number];
export type PoseSummary = {
  version: 1;
  model: "MoveNet.SinglePose.Thunder";
  durationMs: number;
  requestedFrames: number;
  framesAnalyzed: number;
  sampleFps: number;
  overallVisibility: number;
  seriesColumns: PoseSeriesColumn[];
  series: (number | null)[][];
};

const trackedNames = ["left_shoulder", "right_shoulder", "left_elbow", "right_elbow", "left_wrist", "right_wrist", "left_hip", "right_hip", "left_knee", "right_knee", "left_ankle", "right_ankle"] as const;

function rounded(value: number, digits = 4): number {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function angle(a?: ThunderKeypoint, b?: ThunderKeypoint, c?: ThunderKeypoint): number | null {
  if (!a || !b || !c || Math.min(a.score, b.score, c.score) < 0.3) return null;
  const first = { x: a.x - b.x, y: a.y - b.y };
  const second = { x: c.x - b.x, y: c.y - b.y };
  const denominator = Math.hypot(first.x, first.y) * Math.hypot(second.x, second.y);
  if (!denominator) return null;
  const cosine = Math.min(1, Math.max(-1, (first.x * second.x + first.y * second.y) / denominator));
  return rounded((Math.acos(cosine) * 180) / Math.PI, 1);
}

export function poseFrameTimestamps(durationMs: number, options: { targetFps: number; maxFrames: number }): number[] {
  const requested = Math.max(1, Math.ceil((Math.max(1, durationMs) / 1_000) * options.targetFps));
  const count = Math.min(options.maxFrames, requested);
  if (count === requested) return Array.from({ length: count }, (_, index) => Math.min(durationMs - 1, Math.round((index * 1_000) / options.targetFps)));
  return Array.from({ length: count }, (_, index) => Math.min(durationMs - 1, Math.round((index * durationMs) / count)));
}

export function buildPoseSummary(frames: ThunderPoseFrame[], durationMs: number): PoseSummary | null {
  const reliable = frames.flatMap((frame) => {
    const points = new Map(frame.keypoints.map((keypoint) => [keypoint.name, keypoint]));
    const tracked = trackedNames.map((name) => points.get(name)).filter((item): item is ThunderKeypoint => Boolean(item));
    const visible = tracked.filter((item) => item.score >= 0.3);
    if (visible.length < 8) return [];

    const read = (name: typeof trackedNames[number], axis: "x" | "y") => {
      const item = points.get(name);
      return item && item.score >= 0.3 ? rounded(item[axis]) : null;
    };
    const delta = (left: typeof trackedNames[number], right: typeof trackedNames[number]) => {
      const leftPoint = points.get(left);
      const rightPoint = points.get(right);
      return leftPoint && rightPoint && Math.min(leftPoint.score, rightPoint.score) >= 0.3 ? rounded(leftPoint.y - rightPoint.y) : null;
    };
    const row: (number | null)[] = [
      Math.max(0, Math.round(frame.timeMs)),
      rounded(visible.reduce((sum, item) => sum + item.score, 0) / visible.length),
      ...trackedNames.flatMap((name) => [read(name, "x"), read(name, "y")]),
      angle(points.get("left_shoulder"), points.get("left_elbow"), points.get("left_wrist")),
      angle(points.get("right_shoulder"), points.get("right_elbow"), points.get("right_wrist")),
      angle(points.get("left_hip"), points.get("left_knee"), points.get("left_ankle")),
      angle(points.get("right_hip"), points.get("right_knee"), points.get("right_ankle")),
      delta("left_shoulder", "right_shoulder"),
      delta("left_wrist", "right_wrist"),
      delta("left_hip", "right_hip"),
    ];
    return [{ row, visibility: Number(row[1]) }];
  });

  if (reliable.length < 4) return null;
  return {
    version: 1,
    model: "MoveNet.SinglePose.Thunder",
    durationMs,
    requestedFrames: frames.length,
    framesAnalyzed: reliable.length,
    sampleFps: rounded(reliable.length / Math.max(0.001, durationMs / 1_000), 2),
    overallVisibility: rounded(reliable.reduce((sum, item) => sum + item.visibility, 0) / reliable.length),
    seriesColumns: [...poseSeriesColumns],
    series: reliable.map((item) => item.row),
  };
}
