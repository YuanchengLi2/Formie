from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any


@dataclass(frozen=True)
class Landmark:
    x: float
    y: float
    z: float
    visibility: float


@dataclass(frozen=True)
class PoseFrame:
    timestamp_ms: int
    landmarks: dict[str, Landmark]


@dataclass(frozen=True)
class RepBoundary:
    number: int
    start_ms: int
    end_ms: int
    amplitude: float


@dataclass
class PoseEvidence:
    sample_rate: float = 15.0
    frames: list[PoseFrame] = field(default_factory=list)
    rep_boundaries: list[RepBoundary] = field(default_factory=list)
    joint_angles: dict[str, list[tuple[int, float, float]]] = field(default_factory=dict)
    range_of_motion: dict[str, float] = field(default_factory=dict)
    pauses: list[tuple[int, int]] = field(default_factory=list)
    rep_comparison: dict[str, float] = field(default_factory=dict)
    possible_asymmetry: dict[str, float] = field(default_factory=dict)
    visibility: dict[str, float] = field(default_factory=dict)
    evidence_timestamps_ms: list[int] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)
