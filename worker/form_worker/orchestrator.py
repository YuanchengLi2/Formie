from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable

from .models import PoseEvidence


@dataclass
class AnalysisWorkerDependencies:
    update_stage: Callable[[str, str], None]
    download_video: Callable[[dict[str, Any], Path], Path]
    validate_video: Callable[[Path], Any]
    extract_pose: Callable[[Path], PoseEvidence]
    save_pose_evidence: Callable[[dict[str, Any], PoseEvidence], None]
    extract_frames: Callable[[Path, PoseEvidence, Path], list[Path]]
    analyze: Callable[[Path, list[Path], PoseEvidence, dict[str, Any] | None], dict[str, Any]]
    verify: Callable[[dict[str, Any], int, dict[str, float]], dict[str, Any]]
    save_result: Callable[[dict[str, Any], dict[str, Any]], None]


class AnalysisOrchestrator:
    def __init__(self, dependencies: AnalysisWorkerDependencies) -> None:
        self.dependencies = dependencies

    def run(self, job: dict[str, Any], workspace: str | Path) -> dict[str, Any]:
        session_id = job["session_id"]
        workspace_path = Path(workspace)
        workspace_path.mkdir(parents=True, exist_ok=True)

        self.dependencies.update_stage(session_id, "video_check")
        video_path = self.dependencies.download_video(job, workspace_path / "original.mp4")
        metadata = self.dependencies.validate_video(video_path)

        self.dependencies.update_stage(session_id, "pose_tracking")
        pose_evidence = self.dependencies.extract_pose(video_path)
        self.dependencies.save_pose_evidence(job, pose_evidence)
        self.dependencies.update_stage(session_id, "rep_detection")
        frames = self.dependencies.extract_frames(video_path, pose_evidence, workspace_path / "evidence")

        self.dependencies.update_stage(session_id, "recognition")
        self.dependencies.update_stage(session_id, "technique_review")
        self.dependencies.update_stage(session_id, "coaching")
        candidate = self.dependencies.analyze(video_path, frames, pose_evidence, job.get("previous_result"))
        verified = self.dependencies.verify(candidate, metadata.duration_ms, pose_evidence.visibility)
        self.dependencies.save_result(job, verified)
        return verified
