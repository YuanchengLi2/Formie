from __future__ import annotations

from copy import deepcopy
from typing import Any


def _verified_finding(
    finding: dict[str, Any],
    *,
    duration_ms: int,
    landmark_visibility: dict[str, float],
) -> dict[str, Any] | None:
    accepted_evidence = []
    for evidence in finding.get("evidence", []):
        start = evidence.get("startMs")
        end = evidence.get("endMs")
        confidence = evidence.get("confidence", 0)
        landmarks = evidence.get("observableLandmarks") or []
        if not isinstance(start, int) or not isinstance(end, int) or start < 0 or end <= start or end > duration_ms:
            continue
        if confidence < 0.75 or not str(evidence.get("visualEvidence", "")).strip() or not landmarks:
            continue
        if any(landmark_visibility.get(name, 0.0) < 0.75 for name in landmarks):
            continue
        accepted_evidence.append(evidence)
    if not accepted_evidence:
        return None
    accepted = deepcopy(finding)
    accepted["evidence"] = accepted_evidence
    return accepted


def verify_analysis(candidate: dict[str, Any], *, duration_ms: int, landmark_visibility: dict[str, float]) -> dict[str, Any]:
    result = deepcopy(candidate)
    recognition = result.setdefault("recognition", {})
    recognition.setdefault("label", None)
    recognition.setdefault("variation", None)
    recognition.setdefault("equipment", [])
    recognition.setdefault("confidence", 0.0)
    recognition.setdefault("alternatives", [])
    recognition.setdefault("catalogExerciseId", None)

    for section in ("didWell", "priorityCorrections", "coachingCues"):
        result[section] = [
            verified
            for finding in result.get(section, [])
            if (verified := _verified_finding(finding, duration_ms=duration_ms, landmark_visibility=landmark_visibility)) is not None
        ]

    if recognition.get("confidence", 0) < 0.8 or len(result.get("scoreRationale", [])) < 2:
        result["score"] = None
        result["scoreRationale"] = []

    video_check = result.setdefault("videoCheck", {})
    outcome = video_check.get("outcome", "partial")
    if outcome == "unable":
        result.update({"status": "unable", "overallAssessment": None, "score": None, "scoreRationale": [], "didWell": [], "priorityCorrections": [], "coachingCues": []})
        video_check.setdefault("retryReason", "The movement was not visible enough for technique coaching.")
        video_check.setdefault("retryInstruction", "Keep the working joints in frame and try again from any stable position.")
    elif outcome == "partial":
        result["status"] = "partial"
    elif result.get("status") not in {"complete", "partial"}:
        result["status"] = "partial"

    if outcome != "unable" and not any(result[section] for section in ("didWell", "priorityCorrections", "coachingCues")):
        result["status"] = "partial"
        result["viewNote"] = result.get("viewNote") or "FORM reviewed the visible movement, but no technique claim had enough evidence to present confidently. A wider view may reveal more next time."
    return result
