from math import isclose

from form_worker.measurements import angle_degrees, build_pose_evidence, possible_asymmetry, range_of_motion
from form_worker.models import Landmark, PoseFrame


def point(x: float, y: float, visibility: float = 1.0) -> Landmark:
    return Landmark(x=x, y=y, z=0.0, visibility=visibility)


def test_right_angle_is_measured_in_image_plane() -> None:
    assert isclose(angle_degrees(point(1, 0), point(0, 0), point(0, 1)), 90.0)


def test_range_of_motion_ignores_hidden_samples() -> None:
    samples = [(20.0, 0.95), (95.0, 0.9), (170.0, 0.2)]
    assert range_of_motion(samples, visibility_threshold=0.75) == 75.0


def test_asymmetry_requires_both_sides_to_be_visible() -> None:
    assert possible_asymmetry([(80, 0.9)], [(100, 0.9)], visibility_threshold=0.75, difference_threshold=10) == 20.0
    assert possible_asymmetry([(80, 0.9)], [(100, 0.4)], visibility_threshold=0.75, difference_threshold=10) is None


def test_pose_evidence_keeps_angles_visibility_and_candidate_events() -> None:
    frames = []
    wrist_y = [0.8, 0.2, 0.8, 0.2, 0.8]
    for index, y in enumerate(wrist_y):
        frames.append(
            PoseFrame(
                timestamp_ms=index * 500,
                landmarks={
                    "left_shoulder": point(0.5, 0.2),
                    "left_elbow": point(0.5, 0.5),
                    "left_wrist": point(0.5, y),
                },
            )
        )
    evidence = build_pose_evidence(frames)
    assert evidence.joint_angles["left_elbow"]
    assert evidence.visibility["left_wrist"] == 1.0
    assert evidence.rep_boundaries
    assert evidence.evidence_timestamps_ms
