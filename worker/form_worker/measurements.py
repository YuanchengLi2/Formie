from __future__ import annotations

from math import acos, degrees, hypot
from statistics import mean
from typing import Iterable, Sequence

from .models import Landmark, PoseEvidence, PoseFrame
from .repetitions import compare_repetitions, detect_pauses, detect_repetitions


def angle_degrees(first: Landmark, vertex: Landmark, third: Landmark) -> float:
    """Return the observable 2D image-plane angle with no false 3D claim."""
    vector_a = (first.x - vertex.x, first.y - vertex.y)
    vector_b = (third.x - vertex.x, third.y - vertex.y)
    magnitude = hypot(*vector_a) * hypot(*vector_b)
    if magnitude == 0:
        raise ValueError("An angle requires three distinct visible points")
    cosine = max(-1.0, min(1.0, (vector_a[0] * vector_b[0] + vector_a[1] * vector_b[1]) / magnitude))
    return degrees(acos(cosine))


def range_of_motion(samples: Iterable[tuple[float, float]], visibility_threshold: float = 0.75) -> float | None:
    visible = [value for value, visibility in samples if visibility >= visibility_threshold]
    return max(visible) - min(visible) if visible else None


def visible_landmark_fraction(frames: Sequence[PoseFrame], names: Sequence[str], threshold: float = 0.75) -> float:
    if not frames or not names:
        return 0.0
    total = len(frames) * len(names)
    visible = sum(
        1
        for frame in frames
        for name in names
        if (landmark := frame.landmarks.get(name)) is not None and landmark.visibility >= threshold
    )
    return visible / total


def possible_asymmetry(
    left_samples: Iterable[tuple[float, float]],
    right_samples: Iterable[tuple[float, float]],
    *,
    visibility_threshold: float = 0.75,
    difference_threshold: float = 10.0,
) -> float | None:
    paired = [
        abs(left_value - right_value)
        for (left_value, left_visibility), (right_value, right_visibility) in zip(left_samples, right_samples)
        if left_visibility >= visibility_threshold and right_visibility >= visibility_threshold
    ]
    if not paired:
        return None
    difference = mean(paired)
    return difference if difference >= difference_threshold else None


JOINT_DEFINITIONS = {
    "left_elbow": ("left_shoulder", "left_elbow", "left_wrist"),
    "right_elbow": ("right_shoulder", "right_elbow", "right_wrist"),
    "left_shoulder": ("left_elbow", "left_shoulder", "left_hip"),
    "right_shoulder": ("right_elbow", "right_shoulder", "right_hip"),
    "left_hip": ("left_shoulder", "left_hip", "left_knee"),
    "right_hip": ("right_shoulder", "right_hip", "right_knee"),
    "left_knee": ("left_hip", "left_knee", "left_ankle"),
    "right_knee": ("right_hip", "right_knee", "right_ankle"),
}


def build_pose_evidence(frames: Sequence[PoseFrame], visibility_threshold: float = 0.75) -> PoseEvidence:
    evidence = PoseEvidence(frames=list(frames))
    landmark_names = sorted({name for frame in frames for name in frame.landmarks})
    evidence.visibility = {
        name: visible_landmark_fraction(frames, [name], threshold=visibility_threshold)
        for name in landmark_names
    }

    for joint_name, landmark_names_for_joint in JOINT_DEFINITIONS.items():
        observations: list[tuple[int, float, float]] = []
        for frame in frames:
            points = [frame.landmarks.get(name) for name in landmark_names_for_joint]
            if any(point is None for point in points):
                continue
            first, vertex, third = points
            assert first is not None and vertex is not None and third is not None
            visibility = min(first.visibility, vertex.visibility, third.visibility)
            try:
                angle = angle_degrees(first, vertex, third)
            except ValueError:
                continue
            observations.append((frame.timestamp_ms, angle, visibility))
        if observations:
            evidence.joint_angles[joint_name] = observations
            rom = range_of_motion([(angle, visibility) for _, angle, visibility in observations], visibility_threshold)
            if rom is not None:
                evidence.range_of_motion[joint_name] = rom

    trajectories: list[tuple[float, list[tuple[int, float]]]] = []
    for name in ("left_wrist", "right_wrist", "left_ankle", "right_ankle", "left_hip", "right_hip"):
        samples = [
            (frame.timestamp_ms, landmark.y)
            for frame in frames
            if (landmark := frame.landmarks.get(name)) is not None and landmark.visibility >= visibility_threshold
        ]
        if len(samples) >= 3:
            amplitude = max(value for _, value in samples) - min(value for _, value in samples)
            trajectories.append((amplitude, samples))
    for observations in evidence.joint_angles.values():
        samples = [(timestamp, angle / 180.0) for timestamp, angle, visibility in observations if visibility >= visibility_threshold]
        if len(samples) >= 3:
            amplitude = max(value for _, value in samples) - min(value for _, value in samples)
            trajectories.append((amplitude, samples))

    if trajectories:
        _, primary = max(trajectories, key=lambda item: item[0])
        evidence.rep_boundaries = detect_repetitions(primary)
        evidence.pauses = detect_pauses(primary)
        repetitions = [
            [value for timestamp, value in primary if rep.start_ms <= timestamp <= rep.end_ms]
            for rep in evidence.rep_boundaries
        ]
        evidence.rep_comparison = compare_repetitions(repetitions)
        evidence.evidence_timestamps_ms = sorted({
            timestamp
            for rep in evidence.rep_boundaries
            for timestamp in (rep.start_ms, (rep.start_ms + rep.end_ms) // 2, rep.end_ms)
        })

    for joint in ("elbow", "shoulder", "hip", "knee"):
        left = evidence.joint_angles.get(f"left_{joint}", [])
        right = evidence.joint_angles.get(f"right_{joint}", [])
        asymmetry = possible_asymmetry(
            [(angle, visibility) for _, angle, visibility in left],
            [(angle, visibility) for _, angle, visibility in right],
            visibility_threshold=visibility_threshold,
        )
        if asymmetry is not None:
            evidence.possible_asymmetry[joint] = asymmetry
    return evidence
