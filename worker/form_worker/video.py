from __future__ import annotations

import json
import subprocess
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class VideoMetadata:
    duration_ms: int
    width: int
    height: int
    rotation: int


def probe_video(path: str | Path) -> VideoMetadata:
    command = ["ffprobe", "-v", "error", "-print_format", "json", "-show_streams", "-show_format", str(path)]
    result = subprocess.run(command, check=True, capture_output=True, text=True)
    payload = json.loads(result.stdout)
    video_stream = next(stream for stream in payload["streams"] if stream.get("codec_type") == "video")
    rotation = int(video_stream.get("tags", {}).get("rotate", 0))
    duration = float(video_stream.get("duration") or payload["format"].get("duration") or 0)
    if duration <= 0 or duration > 60:
        raise ValueError("Video duration must be between 0 and 60 seconds")
    return VideoMetadata(int(duration * 1000), int(video_stream["width"]), int(video_stream["height"]), rotation)


def create_analysis_proxy(source: str | Path, destination: str | Path) -> None:
    subprocess.run(
        ["ffmpeg", "-y", "-i", str(source), "-vf", "fps=15,scale='min(1280,iw)':-2", "-an", "-c:v", "libx264", "-preset", "veryfast", str(destination)],
        check=True,
        capture_output=True,
    )
