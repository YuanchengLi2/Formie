# Staged Generic Evidence Architecture Design

## Goal

Improve exercise-analysis accuracy across exercise families without encoding exercise-specific measurements, thresholds, or coaching rules in the native tracker or server. Preserve the entire 24 FPS tracking result for local frame selection and overlays, while giving Gemini a compact, staged, independently reviewed evidence flow.

## Constraints

- iOS remains the only native tracking platform in this release.
- MediaPipe Pose Landmarker Heavy scans the complete saved recording at a requested 24 FPS with the existing 15-second partial-result deadline.
- Native and server code may measure generic visibility, trajectories, scene motion, reversals, extrema, occlusion, and confidence. They may not label a movement fault or apply exercise-specific geometry rules.
- Gemini remains the semantic authority for exercise identity, repetitions, findings, and advice.
- Server code remains authoritative for validation, reconciliation, score arithmetic, confidence gates, and unsupported-claim rejection.
- No separate worker or custom equipment model is introduced.
- Existing video-only analysis remains the fallback.

## Architecture

### Evidence compilation

The client retains the full 24 FPS tracker result only long enough to select frames and construct overlays. `buildTrackerSummary` produces a validated version-3 packet containing provenance, camera metadata, generic event windows, confidence-gated event landmarks, and confidence-gated equipment trajectories. Continuous overlay frames remain persisted for UI overlays but are excluded from every Gemini prompt.

The server runs all tracker summaries through a shared `compactMotionEvidence` boundary before any model call. It removes UI-only fields, limits generic events and equipment points deterministically, rounds numeric data, and enforces a serialized 24 KB ceiling. The benchmark runner uses this same function.

### Staged Gemini reasoning

Gemini analysis is divided into foundation and coaching stages:

1. Two independent foundation passes identify the exercise, camera context, and complete-cycle repetition timeline from the original video plus compact evidence.
2. If normalized identity or repetition count disagrees, one foundation adjudication pass decides from the original video. If adjudication is unavailable, recognition confidence is reduced and repetition count is withheld.
3. The main coaching generation receives the resolved foundation as fixed evidence. Its recognition and repetition timeline are replaced by the resolved foundation before contract validation so a later response cannot silently change them.
4. Candidate priority corrections are not scoreable until their exact evidence is reviewed.
5. Criterion auditing remains independent and the server computes the final technique score.

All Gemini calls use low-variance generation settings in addition to high thinking. Model confidence never suppresses foundation consensus.

### Exact-frame continuation

Initial analysis uploads retain twelve coverage/event frames. After candidate findings exist, the server creates up to three generic exact-frame requests. Each request contains a finding ID, candidate peak timestamp, and five offsets representing two 24 FPS frames before, the candidate frame, and two frames after.

`analyze-video` stores the request and returns `status: processing`, `stage: exact_frame_review`, and the pending requests. The recording remains in the capture store after upload. The analysis route extracts the requested frames using the existing native `extractKeyframes` function, uploads them to preallocated private paths, and posts the exact-frame manifest. Analysis then resumes and the evidence auditor must confirm, revise, or reject each finding from the five-frame source-resolution window.

If the recording is no longer local, analysis waits no longer than 20 seconds and resumes with the original video plus initial frames. Findings without an exact source frame remain coaching-only when supported by video but cannot contribute to the score above 0.74 evidence confidence.

### Audit reliability

Malformed foundation or score-audit JSON is retried once with the exact parser error and a repair prompt. A second failure marks that audit unavailable. It never causes the primary draft to become authoritative for scoring. Contradictory criterion text and ratings remain rejected.

### Persistence and client behavior

`analysis_sessions` stores `foundation_result`, `exact_frame_requests`, `exact_frame_manifest`, and `exact_frames_requested_at`. `create-analysis` preallocates fifteen additional private JPEG upload targets. `analysis-status` and `analyze-video` return pending frame requests. The client deduplicates uploads by request ID, cleans temporary exact frames after upload, and continues polling.

Saved-video reanalysis has no local source-frame callback. It uses already persisted exact frames when present; otherwise it takes the 20-second fallback and honestly lowers evidence confidence.

## Validation

Tests cover evidence budgets, foundation consensus/adjudication, high-confidence recognition disagreement, repetition disagreement, malformed-audit retry, exact-frame request generation, client deduplication, native frame offsets, timeout fallback, verified-only score evidence, and historical compatibility.

Release remains shadow-first. Accuracy is evaluated across at least 30 labeled recordings spanning press, pull, squat, hinge, lunge, curl, carry, core, machine, and bodyweight families. No single exercise produces a local rule. Public assist requires recognition, repetition, evidence timing, correction agreement, false-high, bias, actionable-advice, unsupported-claim, and latency gates from the approved release plan.
