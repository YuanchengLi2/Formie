from __future__ import annotations

from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any


class WorkerRepository:
    def __init__(self, client: Any, worker_id: str) -> None:
        self.client = client
        self.worker_id = worker_id

    def lease_job(self) -> dict[str, Any] | None:
        response = self.client.table("analysis_jobs").select("id,session_id,attempt").eq("stage", "queued").order("created_at").limit(1).execute()
        if not response.data:
            return None
        candidate = response.data[0]
        lease_until = (datetime.now(timezone.utc) + timedelta(minutes=5)).isoformat()
        claimed = (
            self.client.table("analysis_jobs")
            .update({"stage": "leased", "lease_until": lease_until, "worker_version": self.worker_id, "attempt": candidate["attempt"] + 1})
            .eq("id", candidate["id"])
            .eq("stage", "queued")
            .select("id,session_id,attempt")
            .execute()
        )
        if not claimed.data:
            return None
        session = self.client.table("analysis_sessions").select("id,video_path,previous_session_id,user_id").eq("id", candidate["session_id"]).single().execute().data
        previous_result = None
        if session.get("previous_session_id"):
            previous = self.client.table("analysis_results").select("*").eq("session_id", session["previous_session_id"]).maybe_single().execute()
            previous_result = previous.data
        return {**claimed.data[0], **session, "previous_result": previous_result}

    def download_video(self, job: dict[str, Any], destination: Path) -> Path:
        if not job.get("video_path"):
            raise ValueError("Queued session has no private video path")
        destination.write_bytes(self.client.storage.from_("analysis-videos").download(job["video_path"]))
        return destination

    def update_stage(self, session_id: str, stage: str) -> None:
        now = datetime.now(timezone.utc).isoformat()
        self.client.table("analysis_sessions").update({"status": "processing", "stage": stage, "updated_at": now}).eq("id", session_id).execute()
        self.client.table("analysis_jobs").update({"stage": stage, "lease_until": (datetime.now(timezone.utc) + timedelta(minutes=5)).isoformat(), "updated_at": now}).eq("session_id", session_id).execute()

    def save_result(self, job: dict[str, Any], result: dict[str, Any]) -> None:
        recognition = result["recognition"]
        now = datetime.now(timezone.utc).isoformat()
        session_update = {
            "status": result["status"],
            "stage": "coaching",
            "detected_label": recognition.get("label"),
            "detected_variation": recognition.get("variation"),
            "detected_equipment": recognition.get("equipment", []),
            "recognition_confidence": recognition.get("confidence", 0),
            "recognition_alternatives": recognition.get("alternatives", []),
            "exercise_id": recognition.get("catalogExerciseId"),
            "completed_at": now,
            "updated_at": now,
        }
        self.client.table("analysis_sessions").update(session_update).eq("id", job["session_id"]).execute()
        result_row = {
            "session_id": job["session_id"],
            "status": result["status"],
            "video_check": result["videoCheck"],
            "overall_assessment": result.get("overallAssessment"),
            "score": result.get("score"),
            "score_rationale": result.get("scoreRationale", []),
            "did_well": result.get("didWell", []),
            "priority_corrections": result.get("priorityCorrections", []),
            "coaching_cues": result.get("coachingCues", []),
            "view_note": result.get("viewNote"),
            "comparison": result.get("comparison"),
            "analysis_version": "form-worker-0.1.0",
        }
        self.client.table("analysis_results").upsert(result_row, on_conflict="session_id").execute()
        self.client.table("analysis_jobs").update({"stage": "complete", "lease_until": None, "model_name": "gemini-3.5-flash", "updated_at": now}).eq("session_id", job["session_id"]).execute()

    def fail_job(self, job: dict[str, Any], error: Exception) -> None:
        now = datetime.now(timezone.utc).isoformat()
        self.client.table("analysis_sessions").update({"status": "failed", "failure_code": type(error).__name__, "updated_at": now}).eq("id", job["session_id"]).execute()
        self.client.table("analysis_jobs").update({"stage": "failed", "lease_until": None, "error_detail": str(error)[:2000], "updated_at": now}).eq("session_id", job["session_id"]).execute()
