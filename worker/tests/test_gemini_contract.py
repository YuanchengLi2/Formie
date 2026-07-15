import json
from pathlib import Path

import pytest

from form_worker.gemini import GeminiAnalyzer
from form_worker.models import PoseEvidence


class FakeFiles:
    def __init__(self) -> None:
        self.uploads = []
        self.deletes = []

    def upload(self, *, file, config=None):
        uploaded = type("Uploaded", (), {"name": Path(file).name, "uri": f"gemini://{Path(file).name}", "state": "ACTIVE"})()
        self.uploads.append((file, config, uploaded))
        return uploaded

    def delete(self, *, name):
        self.deletes.append(name)


class FakeModels:
    def __init__(self) -> None:
        self.calls = []
        self.responses = [
            {"label": "High-to-low cable row", "variation": None, "equipment": ["cable machine"], "environment": "gym", "confidence": 0.91, "alternatives": []},
            {"status": "partial", "videoCheck": {"outcome": "partial", "usableObservations": ["elbow path"], "limitations": ["hips obscured"], "retryReason": None, "retryInstruction": None}, "overallAssessment": "Useful visible movement.", "score": None, "scoreRationale": [], "didWell": [], "priorityCorrections": [], "coachingCues": [], "viewNote": "The low angle still showed elbow path.", "comparison": None},
        ]

    def generate_content(self, **kwargs):
        self.calls.append(kwargs)
        return type("Response", (), {"text": json.dumps(self.responses.pop(0))})()


class FakeClient:
    def __init__(self) -> None:
        self.files = FakeFiles()
        self.models = FakeModels()


def test_two_pass_request_uses_original_video_pose_evidence_and_open_ended_contract(tmp_path) -> None:
    video = tmp_path / "original.mp4"
    video.write_bytes(b"video")
    frame = tmp_path / "evidence.jpg"
    frame.write_bytes(b"image")
    client = FakeClient()

    result = GeminiAnalyzer(client, profile_provider=lambda recognition: {"exercise": recognition["label"], "standards": ["controlled elbow path"]}).analyze(video, [frame], PoseEvidence(visibility={"left_elbow": 0.9}), previous_result={"priorityCorrections": []})

    assert result["recognition"]["label"] == "High-to-low cable row"
    assert len(client.models.calls) == 2
    assert all(call["model"] == "gemini-3.5-flash" for call in client.models.calls)
    assert all(call["config"]["thinking_config"]["thinking_level"] == "medium" for call in client.models.calls)
    coaching_contents = json.dumps(client.models.calls[1]["contents"], default=lambda value: getattr(value, "uri", str(value)))
    assert "original.mp4" in coaching_contents
    assert "left_elbow" in coaching_contents
    assert "previous" in coaching_contents.lower()
    assert "controlled elbow path" in coaching_contents
    assert client.models.calls[1]["config"]["response_json_schema"]["properties"]["priorityCorrections"]["type"] == "array"
    assert client.files.deletes == ["evidence.jpg", "original.mp4"]


def test_invalid_structured_output_is_retried_once(tmp_path) -> None:
    video = tmp_path / "original.mp4"
    video.write_bytes(b"video")
    client = FakeClient()
    valid_recognition = client.models.responses[0]
    valid_coaching = client.models.responses[1]
    client.models.responses = ["not-json", valid_recognition, valid_coaching]
    original_generate = client.models.generate_content

    def generate_content(**kwargs):
        client.models.calls.append(kwargs)
        value = client.models.responses.pop(0)
        text = value if isinstance(value, str) else json.dumps(value)
        return type("Response", (), {"text": text})()

    client.models.generate_content = generate_content
    result = GeminiAnalyzer(client).analyze(video, [], PoseEvidence())
    assert result["recognition"]["label"] == "High-to-low cable row"
    assert len(client.models.calls) == 3
    assert "failed validation" in str(client.models.calls[1]["contents"][-1]).lower()


def test_analysis_reports_stages_when_the_work_really_begins(tmp_path) -> None:
    video = tmp_path / "original.mp4"
    video.write_bytes(b"video")
    stages = []

    GeminiAnalyzer(FakeClient()).analyze(video, [], PoseEvidence(), on_stage=stages.append)

    assert stages == ["recognition", "technique_review"]


def test_uploaded_files_are_deleted_when_gemini_output_fails(tmp_path) -> None:
    video = tmp_path / "original.mp4"
    video.write_bytes(b"video")
    client = FakeClient()
    client.models.responses = ["not-json", "still-not-json"]

    with pytest.raises(ValueError, match="invalid structured output twice"):
        GeminiAnalyzer(client).analyze(video, [], PoseEvidence())

    assert client.files.deletes == ["original.mp4"]
