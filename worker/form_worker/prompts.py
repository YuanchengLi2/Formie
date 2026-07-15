from __future__ import annotations

from typing import Any


RECOGNITION_SCHEMA: dict[str, Any] = {
    "type": "object",
    "required": ["label", "variation", "equipment", "environment", "confidence", "alternatives"],
    "properties": {
        "label": {"type": ["string", "null"]},
        "variation": {"type": ["string", "null"]},
        "equipment": {"type": "array", "items": {"type": "string"}},
        "environment": {"type": ["string", "null"]},
        "confidence": {"type": "number", "minimum": 0, "maximum": 1},
        "alternatives": {"type": "array", "items": {"type": "string"}},
    },
}

EVIDENCE_SCHEMA: dict[str, Any] = {
    "type": "object",
    "required": ["startMs", "endMs", "repNumber", "phase", "visualEvidence", "mediaPipeEvidence", "observableLandmarks", "confidence"],
    "properties": {
        "startMs": {"type": "integer"},
        "endMs": {"type": "integer"},
        "repNumber": {"type": ["integer", "null"]},
        "phase": {"type": ["string", "null"]},
        "visualEvidence": {"type": "string"},
        "mediaPipeEvidence": {"type": ["string", "null"]},
        "observableLandmarks": {"type": "array", "items": {"type": "string"}},
        "confidence": {"type": "number"},
    },
}

FINDING_SCHEMA: dict[str, Any] = {
    "type": "object",
    "required": ["id", "title", "detail", "whyItMatters", "correction", "cue", "severity", "evidence"],
    "properties": {
        "id": {"type": "string"},
        "title": {"type": "string"},
        "detail": {"type": "string"},
        "whyItMatters": {"type": "string"},
        "correction": {"type": ["string", "null"]},
        "cue": {"type": ["string", "null"]},
        "severity": {"type": "string", "enum": ["note", "important", "high"]},
        "evidence": {"type": "array", "minItems": 1, "items": EVIDENCE_SCHEMA},
    },
}

ANALYSIS_SCHEMA: dict[str, Any] = {
    "type": "object",
    "required": ["status", "videoCheck", "overallAssessment", "score", "scoreRationale", "didWell", "priorityCorrections", "coachingCues", "viewNote", "comparison"],
    "properties": {
        "status": {"type": "string", "enum": ["complete", "partial", "unable"]},
        "videoCheck": {
            "type": "object",
            "required": ["outcome", "usableObservations", "limitations", "retryReason", "retryInstruction"],
            "properties": {
                "outcome": {"type": "string", "enum": ["usable", "partial", "unable"]},
                "usableObservations": {"type": "array", "items": {"type": "string"}},
                "limitations": {"type": "array", "items": {"type": "string"}},
                "retryReason": {"type": ["string", "null"]},
                "retryInstruction": {"type": ["string", "null"]},
            },
        },
        "overallAssessment": {"type": ["string", "null"]},
        "score": {"type": ["number", "null"]},
        "scoreRationale": {
            "type": "array",
            "items": {
                "type": "object",
                "required": ["criterion", "observed", "impact", "confidence"],
                "properties": {
                    "criterion": {"type": "string"},
                    "observed": {"type": "string"},
                    "impact": {"type": "number", "minimum": 0, "maximum": 100},
                    "confidence": {"type": "number", "minimum": 0.75, "maximum": 1},
                },
            },
        },
        "didWell": {"type": "array", "items": FINDING_SCHEMA},
        "priorityCorrections": {"type": "array", "items": FINDING_SCHEMA},
        "coachingCues": {"type": "array", "items": FINDING_SCHEMA},
        "viewNote": {"type": ["string", "null"]},
        "comparison": {
            "oneOf": [
                {"type": "null"},
                {
                    "type": "object",
                    "required": ["previousSessionId", "summary", "priorityIssueImproved"],
                    "properties": {
                        "previousSessionId": {"type": "string"},
                        "summary": {"type": "string"},
                        "priorityIssueImproved": {"type": ["boolean", "null"]},
                    },
                },
            ],
        },
    },
}


def recognition_prompt() -> str:
    return """Watch the entire original recording. Identify the exercise pattern, useful descriptive variation, equipment, and environment. Recognition is open-ended and is not limited to a catalog. A brand-specific machine name is optional; movement direction and setup matter more. Distinguish pushing from pulling and intentional variants from mistakes. If the exact niche variation is uncertain, return the best descriptive label, alternatives, and calibrated confidence. Do not critique technique in this pass."""


def coaching_prompt(recognition: dict[str, Any]) -> str:
    return f"""You are FORM, an evidence-grounded exercise coach. The recognition pass returned: {recognition}.

Analyze everything the recording makes visible and provide useful advice despite an imperfect, floor-up, front, side, diagonal, low, or partially obstructed angle. An imperfect angle is never a reason to reject the entire recording. MediaPipe measurements support your visual reasoning; they are not a pass/fail gate. If one joint or quality cannot be assessed, omit claims about it and continue coaching everything else you can see.

Return every meaningful supported item: as many strengths, priority improvements, and coaching cues as the evidence warrants, with no fixed maximum. Every finding must cite a real timestamp interval, visible landmarks, and confidence at least 0.75. Do not fabricate muscle activation, pain, internal forces, exact 3D angles, or details hidden by equipment. Treat unusual exercise variations according to the movement being attempted, not generic form rules.

For a reasonable recording, provide genuine technique coaching. If virtually no movement is visible, return practical recording guidance rather than a dead-end rejection. Only include a numeric score when exercise recognition is at least 0.8 and at least two visible criteria support it. Briefly explain what the angle revealed and what it limited."""
