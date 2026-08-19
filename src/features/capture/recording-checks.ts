export const RECORDING_CHECKS = [
  "Camera isn’t too far away.",
  "Whole body visible.",
  "Whole movement visible.",
  "Stable and not shaky.",
  "Nothing blocks your body.",
  "Camera stays in the same position.",
] as const;

export const RECORDING_CHECK_DETAILS = [
  "Zoom in so your body takes up a good portion of the frame.",
  "Keep your body visible from head to feet.",
  "Show every rep clearly from start to finish.",
  "Keep the camera steady throughout the recording.",
  "Move equipment and objects away from important joints.",
  "Do not move or change the camera angle during the set.",
] as const;

export type RecordingCheck = (typeof RECORDING_CHECKS)[number];
