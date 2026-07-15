from __future__ import annotations

from typing import Sequence

import numpy as np

from .models import RepBoundary


def detect_repetitions(
    samples: Sequence[tuple[int, float]],
    *,
    min_duration_ms: int = 500,
    min_amplitude: float = 0.15,
) -> list[RepBoundary]:
    if len(samples) < 3:
        return []
    values = np.asarray([value for _, value in samples], dtype=float)
    timestamps = [timestamp for timestamp, _ in samples]
    peak_indices = [
        index
        for index, value in enumerate(values)
        if (index == 0 or value >= values[index - 1]) and (index == len(values) - 1 or value >= values[index + 1])
    ]
    reps: list[RepBoundary] = []
    for start_index, end_index in zip(peak_indices, peak_indices[1:]):
        duration = timestamps[end_index] - timestamps[start_index]
        segment = values[start_index : end_index + 1]
        amplitude = float(np.max(segment) - np.min(segment))
        if duration >= min_duration_ms and amplitude >= min_amplitude:
            reps.append(RepBoundary(len(reps) + 1, timestamps[start_index], timestamps[end_index], amplitude))
    return reps


def detect_pauses(
    samples: Sequence[tuple[int, float]],
    *,
    minimum_pause_ms: int = 350,
    delta_threshold: float = 0.02,
) -> list[tuple[int, int]]:
    if len(samples) < 2:
        return []
    pauses: list[tuple[int, int]] = []
    pause_start: int | None = None
    for index in range(1, len(samples)):
        previous_time, previous_value = samples[index - 1]
        current_time, current_value = samples[index]
        if abs(current_value - previous_value) <= delta_threshold:
            if pause_start is None:
                pause_start = previous_time
        elif pause_start is not None:
            if previous_time - pause_start >= minimum_pause_ms:
                pauses.append((pause_start, previous_time))
            pause_start = None
    if pause_start is not None and samples[-1][0] - pause_start >= minimum_pause_ms:
        pauses.append((pause_start, samples[-1][0]))
    return pauses


def compare_repetitions(repetitions: Sequence[Sequence[float]], points: int = 25) -> dict[str, float]:
    if len(repetitions) < 2:
        return {"mean_difference": 0.0, "consistency": 1.0}
    axis = np.linspace(0.0, 1.0, points)
    aligned = np.asarray([
        np.interp(axis, np.linspace(0.0, 1.0, len(repetition)), np.asarray(repetition, dtype=float))
        for repetition in repetitions
        if len(repetition) >= 2
    ])
    if len(aligned) < 2:
        return {"mean_difference": 0.0, "consistency": 1.0}
    mean_difference = float(np.mean(np.std(aligned, axis=0)))
    scale = float(np.ptp(aligned)) or 1.0
    return {"mean_difference": mean_difference, "consistency": max(0.0, 1.0 - mean_difference / scale)}
