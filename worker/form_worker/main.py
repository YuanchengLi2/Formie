from __future__ import annotations

import os
import tempfile
import time
from pathlib import Path

from google import genai
from supabase import create_client

from .evidence_frames import extract_evidence_frames
from .gemini import GeminiAnalyzer
from .measurements import build_pose_evidence
from .orchestrator import AnalysisOrchestrator, AnalysisWorkerDependencies
from .pose import PoseLandmarkerAdapter
from .repository import WorkerRepository
from .verifier import verify_analysis
from .video import probe_video


def required_environment(name: str) -> str:
    value = os.environ.get(name)
    if not value:
        raise RuntimeError(f"{name} is required")
    return value


def run_once(repository: WorkerRepository, analyzer: GeminiAnalyzer, pose_adapter: PoseLandmarkerAdapter) -> bool:
    job = repository.lease_job()
    if not job:
        return False
    try:
        with tempfile.TemporaryDirectory(prefix=f"form-{job['session_id']}-") as directory:
            orchestrator = AnalysisOrchestrator(
                AnalysisWorkerDependencies(
                    update_stage=repository.update_stage,
                    download_video=repository.download_video,
                    validate_video=probe_video,
                    extract_pose=lambda path: build_pose_evidence(pose_adapter.process_video(path)),
                    extract_frames=lambda path, evidence, output: extract_evidence_frames(path, evidence.evidence_timestamps_ms[:24], output),
                    analyze=analyzer.analyze,
                    verify=lambda candidate, duration, visibility: verify_analysis(candidate, duration_ms=duration, landmark_visibility=visibility),
                    save_result=repository.save_result,
                )
            )
            orchestrator.run(job, Path(directory))
        return True
    except Exception as error:
        repository.fail_job(job, error)
        raise


def main() -> None:
    supabase = create_client(required_environment("SUPABASE_URL"), required_environment("SUPABASE_SERVICE_ROLE_KEY"))
    repository = WorkerRepository(supabase, os.environ.get("WORKER_ID", "local-worker"))
    analyzer = GeminiAnalyzer(genai.Client(api_key=required_environment("GEMINI_API_KEY")))
    pose_adapter = PoseLandmarkerAdapter(required_environment("POSE_LANDMARKER_MODEL_PATH"))
    run_continuously = os.environ.get("WORKER_RUN_CONTINUOUSLY", "false").lower() == "true"
    while True:
        processed = run_once(repository, analyzer, pose_adapter)
        if not run_continuously:
            return
        if not processed:
            time.sleep(2)


if __name__ == "__main__":
    main()
