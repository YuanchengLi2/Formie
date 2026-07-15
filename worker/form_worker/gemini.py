from __future__ import annotations

import json
import time
from pathlib import Path
from typing import Any

from .models import PoseEvidence
from .prompts import ANALYSIS_SCHEMA, RECOGNITION_SCHEMA, coaching_prompt, recognition_prompt


class GeminiAnalyzer:
    MODEL = "gemini-3.5-flash"

    def __init__(self, client: Any) -> None:
        self.client = client

    def _upload(self, path: Path, mime_type: str) -> Any:
        uploaded = self.client.files.upload(file=str(path), config={"mime_type": mime_type})
        for _ in range(120):
            state = str(getattr(uploaded, "state", "ACTIVE")).upper()
            if "ACTIVE" in state:
                return uploaded
            if "FAILED" in state:
                raise RuntimeError(f"Gemini could not process {path.name}")
            time.sleep(1)
            uploaded = self.client.files.get(name=uploaded.name)
        raise TimeoutError(f"Gemini file processing timed out for {path.name}")

    @staticmethod
    def _config(schema: dict[str, Any]) -> dict[str, Any]:
        return {
            "response_mime_type": "application/json",
            "response_json_schema": schema,
            "thinking_config": {"thinking_level": "medium"},
        }

    def analyze(
        self,
        original_video: str | Path,
        evidence_frames: list[str | Path],
        pose_evidence: PoseEvidence,
        previous_result: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        video_path = Path(original_video)
        video_file = self._upload(video_path, "video/mp4")
        image_files = [self._upload(Path(path), "image/jpeg") for path in evidence_frames]

        recognition_response = self.client.models.generate_content(
            model=self.MODEL,
            contents=[recognition_prompt(), video_file],
            config=self._config(RECOGNITION_SCHEMA),
        )
        recognition = json.loads(recognition_response.text)
        recognition.setdefault("catalogExerciseId", None)

        evidence_json = json.dumps(pose_evidence.to_dict(), separators=(",", ":"))
        previous_json = json.dumps(previous_result, separators=(",", ":")) if previous_result else "No previous result."
        coaching_response = self.client.models.generate_content(
            model=self.MODEL,
            contents=[
                coaching_prompt(recognition),
                "Original video:",
                video_file,
                "Full-resolution evidence frames:",
                *image_files,
                f"MediaPipe evidence: {evidence_json}",
                f"Previous result context: {previous_json}",
            ],
            config=self._config(ANALYSIS_SCHEMA),
        )
        result = json.loads(coaching_response.text)
        result["recognition"] = recognition
        return result
