from pathlib import Path

from form_worker.models import PoseEvidence
from form_worker.orchestrator import AnalysisOrchestrator, AnalysisWorkerDependencies


def test_orchestrator_persists_real_stages_and_validated_result(tmp_path) -> None:
    stages = []
    saved = []
    pose_saved = []
    video = tmp_path / "original.mp4"
    video.write_bytes(b"video")
    result = {"status": "partial", "videoCheck": {"outcome": "partial"}, "recognition": {"confidence": 0.8}, "score": None, "scoreRationale": [], "didWell": [], "priorityCorrections": [], "coachingCues": []}
    dependencies = AnalysisWorkerDependencies(
        update_stage=lambda session_id, stage: stages.append(stage),
        download_video=lambda job, destination: video,
        validate_video=lambda path: type("Metadata", (), {"duration_ms": 5000})(),
        extract_pose=lambda path: PoseEvidence(),
        save_pose_evidence=lambda job, evidence: pose_saved.append(evidence),
        extract_frames=lambda path, evidence, directory: [],
        analyze=lambda path, frames, evidence, previous: result,
        verify=lambda candidate, duration, visibility: candidate,
        save_result=lambda job, candidate: saved.append(candidate),
    )

    AnalysisOrchestrator(dependencies).run({"session_id": "session-1", "previous_result": None}, tmp_path)

    assert stages == ["video_check", "pose_tracking", "rep_detection", "recognition", "technique_review", "coaching"]
    assert saved == [result]
    assert len(pose_saved) == 1
