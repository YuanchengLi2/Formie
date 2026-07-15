from __future__ import annotations

from pathlib import Path

from .models import Landmark, PoseFrame

LANDMARK_NAMES = [
    "nose", "left_eye_inner", "left_eye", "left_eye_outer", "right_eye_inner", "right_eye", "right_eye_outer",
    "left_ear", "right_ear", "mouth_left", "mouth_right", "left_shoulder", "right_shoulder", "left_elbow",
    "right_elbow", "left_wrist", "right_wrist", "left_pinky", "right_pinky", "left_index", "right_index",
    "left_thumb", "right_thumb", "left_hip", "right_hip", "left_knee", "right_knee", "left_ankle", "right_ankle",
    "left_heel", "right_heel", "left_foot_index", "right_foot_index",
]


class PoseLandmarkerAdapter:
    def __init__(self, model_path: str | Path, sample_rate: float = 15.0) -> None:
        import mediapipe as mp

        options = mp.tasks.vision.PoseLandmarkerOptions(
            base_options=mp.tasks.BaseOptions(model_asset_path=str(model_path)),
            running_mode=mp.tasks.vision.RunningMode.VIDEO,
            num_poses=1,
            min_pose_detection_confidence=0.4,
            min_pose_presence_confidence=0.4,
            min_tracking_confidence=0.4,
        )
        self._mp = mp
        self._landmarker = mp.tasks.vision.PoseLandmarker.create_from_options(options)
        self.sample_rate = sample_rate

    def process_video(self, video_path: str | Path) -> list[PoseFrame]:
        import cv2

        capture = cv2.VideoCapture(str(video_path))
        frames: list[PoseFrame] = []
        next_sample_ms = 0.0
        interval_ms = 1000.0 / self.sample_rate
        while capture.isOpened():
            ok, frame = capture.read()
            if not ok:
                break
            timestamp_ms = capture.get(cv2.CAP_PROP_POS_MSEC)
            if timestamp_ms + 0.5 < next_sample_ms:
                continue
            next_sample_ms += interval_ms
            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            image = self._mp.Image(image_format=self._mp.ImageFormat.SRGB, data=rgb)
            result = self._landmarker.detect_for_video(image, int(timestamp_ms))
            landmarks = {}
            if result.pose_landmarks:
                landmarks = {
                    name: Landmark(item.x, item.y, item.z, item.visibility or 0.0)
                    for name, item in zip(LANDMARK_NAMES, result.pose_landmarks[0])
                }
            frames.append(PoseFrame(int(timestamp_ms), landmarks))
        capture.release()
        return frames
