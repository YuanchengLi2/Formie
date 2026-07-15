from form_worker.measurements import visible_landmark_fraction
from form_worker.models import Landmark, PoseFrame


def test_visibility_summary_counts_only_requested_working_landmarks() -> None:
    frames = [
        PoseFrame(timestamp_ms=0, landmarks={"left_elbow": Landmark(0, 0, 0, 0.9), "right_elbow": Landmark(0, 0, 0, 0.4)}),
        PoseFrame(timestamp_ms=100, landmarks={"left_elbow": Landmark(0, 0, 0, 0.8), "right_elbow": Landmark(0, 0, 0, 0.8)}),
    ]
    assert visible_landmark_fraction(frames, ["left_elbow", "right_elbow"], threshold=0.75) == 0.75
