from form_worker.repetitions import compare_repetitions, detect_pauses, detect_repetitions


def test_periodic_trajectory_produces_rep_boundaries() -> None:
    samples = [(0, 1.0), (500, 0.0), (1000, 1.0), (1500, 0.0), (2000, 1.0), (2500, 0.0), (3000, 1.0)]
    reps = detect_repetitions(samples, min_duration_ms=700, min_amplitude=0.5)
    assert [(rep.start_ms, rep.end_ms) for rep in reps] == [(0, 1000), (1000, 2000), (2000, 3000)]


def test_sustained_stillness_is_reported_as_a_pause() -> None:
    samples = [(0, 0.0), (200, 0.01), (400, 0.01), (600, 0.02), (800, 0.5)]
    assert detect_pauses(samples, minimum_pause_ms=400, delta_threshold=0.03) == [(0, 600)]


def test_repetition_comparison_aligns_different_sample_counts() -> None:
    comparison = compare_repetitions([[0.0, 0.5, 1.0], [0.0, 0.25, 0.5, 0.75, 1.0]])
    assert comparison["mean_difference"] < 0.01
    assert comparison["consistency"] > 0.99
