from __future__ import annotations

import json
import time
from pathlib import Path
from typing import Any, Callable

from jsonschema import ValidationError, validate

from .models import PoseEvidence
from .prompts import ANALYSIS_SCHEMA, RECOGNITION_SCHEMA, coaching_prompt, recognition_prompt


class GeminiAnalyzer:
    MODEL = "gemini-3.5-flash"

    def __init__(self, client: Any, profile_provider: Callable[[dict[str, Any]], dict[str, Any] | None] | None = None) -> None:
        self.client = client
        self.profile_provider = profile_provider

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

    def _generate_json(self, contents: list[Any], schema: dict[str, Any]) -> dict[str, Any]:
        attempted_contents = list(contents)
        for attempt in range(2):
            response = self.client.models.generate_content(
                model=self.MODEL,
                contents=attempted_contents,
                config=self._config(schema),
            )
            try:
                payload = json.loads(response.text)
                validate(instance=payload, schema=schema)
                return payload
            except (json.JSONDecodeError, ValidationError, ValueError) as error:
                if attempt == 1:
                    raise ValueError("Gemini returned invalid structured output twice") from error
                attempted_contents = [*contents, f"The previous response failed validation: {error}. Return only a valid object matching the supplied schema."]
        raise AssertionError("unreachable")

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

        recognition = self._generate_json([recognition_prompt(), video_file], RECOGNITION_SCHEMA)
        recognition.setdefault("catalogExerciseId", None)
        profile = self.profile_provider(recognition) if self.profile_provider else None

        evidence_json = json.dumps(pose_evidence.to_dict(), separators=(",", ":"))
        previous_json = json.dumps(previous_result, separators=(",", ":")) if previous_result else "No previous result."
        result = self._generate_json(
            [
                coaching_prompt(recognition),
                "Original video:",
                video_file,
                "Full-resolution evidence frames:",
                *image_files,
                f"MediaPipe evidence: {evidence_json}",
                f"Matching curated profile: {json.dumps(profile, separators=(',', ':')) if profile else 'No catalog match; use a safe dynamic rubric.'}",
                f"Previous result context: {previous_json}",
            ],
            ANALYSIS_SCHEMA,
        )
        result["recognition"] = recognition
        return result
