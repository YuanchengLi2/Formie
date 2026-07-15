from copy import deepcopy

from form_worker.verifier import verify_analysis


def finding(identifier: str, *, confidence: float = 0.9, start_ms: int = 1000, end_ms: int = 1500, landmarks=None, media_pipe_evidence=None):
    return {
        "id": identifier,
        "title": identifier,
        "detail": "Visible movement detail.",
        "whyItMatters": "It affects control.",
        "correction": "Move smoothly.",
        "cue": "Stay controlled.",
        "severity": "important",
        "evidence": [{"startMs": start_ms, "endMs": end_ms, "repNumber": 1, "phase": "concentric", "visualEvidence": "Visible at this interval.", "mediaPipeEvidence": media_pipe_evidence, "observableLandmarks": landmarks or ["left_elbow"], "confidence": confidence}],
    }


def analysis():
    return {
        "status": "complete",
        "recognition": {"label": "Cable row", "variation": None, "equipment": ["cable"], "confidence": 0.92, "alternatives": [], "catalogExerciseId": None},
        "videoCheck": {"outcome": "usable", "usableObservations": ["elbow path"], "limitations": [], "retryReason": None, "retryInstruction": None},
        "overallAssessment": "The visible movement was useful to assess.",
        "score": 80,
        "scoreRationale": [{"criterion": "control", "observed": "steady", "impact": 80, "confidence": 0.9}, {"criterion": "tempo", "observed": "consistent", "impact": 80, "confidence": 0.9}],
        "didWell": [finding("valid")],
        "priorityCorrections": [],
        "coachingCues": [],
        "viewNote": None,
        "comparison": None,
    }


def test_invalid_findings_are_removed_without_using_mediapipe_as_a_visual_gate() -> None:
    candidate = analysis()
    candidate["priorityCorrections"] = [
        finding("low-confidence", confidence=0.74),
        finding("outside-video", start_ms=9000, end_ms=9500),
        finding("hidden-landmark", landmarks=["right_wrist"], media_pipe_evidence="Right wrist angle changed 20 degrees."),
    ]
    candidate["coachingCues"] = [finding(f"cue-{index}") for index in range(5)]

    verified = verify_analysis(candidate, duration_ms=5000, landmark_visibility={"left_elbow": 0.9, "right_wrist": 0.2})

    assert verified["status"] == "complete"
    assert [item["id"] for item in verified["priorityCorrections"]] == ["hidden-landmark"]
    assert verified["priorityCorrections"][0]["evidence"][0]["mediaPipeEvidence"] is None
    assert len(verified["coachingCues"]) == 5
    assert verified["didWell"][0]["id"] == "valid"


def test_uncertain_recognition_removes_score_but_keeps_visible_coaching() -> None:
    candidate = deepcopy(analysis())
    candidate["recognition"]["confidence"] = 0.65
    verified = verify_analysis(candidate, duration_ms=5000, landmark_visibility={"left_elbow": 0.9})
    assert verified["score"] is None
    assert verified["scoreRationale"] == []
    assert verified["didWell"]
