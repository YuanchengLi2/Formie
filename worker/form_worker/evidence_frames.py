from __future__ import annotations

import subprocess
from pathlib import Path


def extract_evidence_frames(video_path: str | Path, timestamps_ms: list[int], output_dir: str | Path) -> list[Path]:
    directory = Path(output_dir)
    directory.mkdir(parents=True, exist_ok=True)
    paths: list[Path] = []
    for index, timestamp_ms in enumerate(sorted(set(timestamps_ms))):
        destination = directory / f"evidence-{index:03d}-{timestamp_ms}.jpg"
        subprocess.run(
            ["ffmpeg", "-y", "-ss", f"{timestamp_ms / 1000:.3f}", "-i", str(video_path), "-frames:v", "1", "-q:v", "2", str(destination)],
            check=True,
            capture_output=True,
        )
        paths.append(destination)
    return paths
