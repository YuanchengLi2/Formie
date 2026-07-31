# Gemini-Requested Pose Evidence Design

Status: approved in conversation on 2026-07-19.

This design supersedes the wrist-reversal, locally inferred repetition, fake equipment-path, and precomputed generic-feature portions of the 2026-07-18 tracker stabilization and 2026-07-19 staged generic evidence documents. It preserves their useful video upload, exact-frame review, server scorecard, compatibility, and failure-recovery work.

## Goal

Give Gemini access to complete single-phone human-pose evidence without encoding exercise identities, repetition definitions, technique thresholds, fault rules, or a predetermined list of important measurements in native or server code.

The tracker acts as a sensor. A neutral processing layer validates and indexes the sensor output. Gemini watches the original video, decides what pose evidence would help, requests bounded mathematical queries, and combines the returned measurements with exact source frames before coaching.

## Non-goals

- Do not recognize exercises locally.
- Do not count repetitions locally.
- Do not label phases, faults, strengths, or corrections locally.
- Do not track machines or infer equipment paths from wrists.
- Do not define acceptable joint-angle, distance, symmetry, range, tempo, or depth thresholds.
- Do not claim metric or motion-capture-grade 3D from one RGB camera.
- Do not add a separate worker service.

## Neutrality invariant

The processing layer may validate, canonicalize, index, select explicitly requested source samples, and perform geometry requested by Gemini. It may not decide which body relationship matters or whether a measured value is good, bad, sufficient, complete, symmetric, safe, or representative of a repetition.

Neutrality is enforced structurally:

1. The private raw artifact remains the source of truth.
2. Original normalized image landmarks and camera-relative world landmarks are retained side by side.
3. No smoothing, interpolation, semantic segmentation, extrema selection, or threshold-based event detection occurs before a query.
4. Quality failures are reported as missing data rather than silently shifted to a nearby favorable frame.
5. Query operations accept arbitrary valid joints and timestamps; no operation names an exercise or fault.
6. Query results contain measurements, confidence, coverage, source-frame indices, coordinate-system labels, and limitations—not conclusions.

## Architecture

```text
saved video
    |
    +--> Gemini video input --------------------------------------+
    |                                                            |
    +--> MediaPipe Heavy at requested 24 FPS                     |
             |                                                    |
             v                                                    |
       raw pose artifact (private storage)                       |
             |                                                    |
             v                                                    |
       neutral pose evidence index                               |
             ^                                                    |
             | bounded query plan selected by Gemini             |
             |                                                    |
       foundation --> pose query planner --> query evaluator     |
                                             |                    |
                                             v                    |
                                    measured evidence ------------+
                                                                  |
                              coaching draft --> exact frames --> audit/score
```

### 1. Raw pose artifact

The existing native module already produces per-frame normalized and world landmarks. The client serializes those frames into a compact version-3 JSON artifact and uploads it to a private signed path beside the video.

The artifact contains:

- model and requested-FPS provenance;
- duration, processed-frame count, pose-frame count, and processing status;
- camera dimensions, rotation, mirroring, and transform;
- an explicit ordered landmark-name table;
- monotonically timestamped source frames;
- normalized image coordinates plus visibility and presence;
- camera-relative world coordinates plus visibility and presence;
- limitations reported by the native model.

Frame values use compact numeric arrays to keep the worst-case 90-second artifact bounded. The artifact does not contain repetitions, events, equipment paths, angles, velocities, symmetry, or coaching labels.

### 2. Neutral evidence index

The Edge Function loads the private artifact and validates it before query execution. Validation checks schema version, numeric finiteness, joint counts, timestamp ordering, duration bounds, allowed coordinate spaces, and a 12 MiB artifact-size ceiling.

The index provides direct lookup by timestamp and joint. It never mutates the raw data. Invalid frames and missing joints remain observable through coverage and limitation fields.

### 3. Gemini pose query planner

After the full-video foundation is resolved, a dedicated low-variance Gemini interaction receives:

- the original video;
- the resolved exercise/camera/repetition foundation;
- the pose manifest only: available joints, coordinate spaces, duration, coverage, and limitations.

It returns zero to twelve queries. Zero is valid when pose data cannot add reliable evidence. The planner selects the joints, operation, coordinate space, time window, and maximum sample count. The server validates every request and rejects the entire invalid plan rather than repairing it into a different question.

Supported version-1 operations are deliberately small and universal:

- `trajectory`: position of one joint over time;
- `relative_position`: position of one joint relative to another;
- `distance`: distance between two joints;
- `angle`: angle formed by any three joints around the middle joint.

No `symmetry`, `rep`, `fault`, `depth_quality`, or exercise-specific operation exists. Gemini can request left and right measurements separately and interpret them itself.

Each query supplies:

```ts
type PoseQuery = {
  id: string;
  operation: "trajectory" | "relative_position" | "distance" | "angle";
  coordinateSpace: "image_normalized" | "world_camera_relative";
  joints: [PoseJoint] | [PoseJoint, PoseJoint] | [PoseJoint, PoseJoint, PoseJoint];
  startMs: number;
  endMs: number;
  maxSamples: number;
};
```

The schema validates the joint count required by each operation. Time windows must lie inside the recording, each plan contains at most twelve queries, and each query returns at most 240 real source samples. Whole-set queries may be sampled uniformly from real source frames; narrow queries can request every available 24 FPS source frame. The evaluator never interpolates missing samples.

### 4. Query results

Every response contains:

- the original query ID and operation;
- source timestamps and source-frame indices;
- measured scalar or vector values;
- confidence derived only from the involved joints' model-provided visibility/presence;
- requested-versus-returned sample coverage;
- the coordinate-space label and units;
- limitations, including estimated monocular depth.

The evaluator does not provide min/max labels, peaks, phase names, comparisons, or judgments unless a future Gemini-selected generic operation explicitly requests that mathematical output.

### 5. Coaching and evidence provenance

The coaching interaction receives the original video, resolved foundation, exact query plan, and query results. A finding that relies on a pose measurement cites one or more query IDs in `measurementIds`. The cited query window must overlap the finding's evidence window.

Pose measurements supplement but never replace visible video evidence. Findings still require exact video timestamps and exact-frame review when they affect coaching priority or score. A measurement with low coverage, occlusion, or unreliable camera-relative depth cannot be presented as precise ground truth.

## Pipeline stages

1. `video_check`: validate the uploaded recording.
2. `video_processing`: resolve the full-video foundation.
3. `pose_query_planning`: let Gemini request neutral pose evidence when a valid artifact exists.
4. `pose_querying`: execute and persist the bounded queries.
5. `technique_review`: generate coaching with video plus query results.
6. `exact_frame_review`: upload and inspect exact source frames for candidate findings.
7. `coaching`: reconcile evidence, audit criteria, and compute the server score.

When tracking, artifact upload, planning, or evaluation is unavailable, analysis continues with the original video and records the pose-evidence failure. Pose failure does not fail the analysis.

## Persistence and privacy

- Store raw pose artifacts in the existing private analysis bucket at `<user>/<session>/pose/landmarks-v3.json`.
- Add signed upload metadata to `create-analysis`.
- Store only the artifact path, neutral manifest, validated query plan, and bounded results on `analysis_sessions`.
- Reanalysis may reuse a still-existing owned artifact.
- Deleting an analysis removes the pose artifact with the session prefix.
- Never send the entire raw pose artifact to Gemini; only the bounded requested query results enter the coaching prompt.

## Client behavior

Video upload and pose tracking continue concurrently. Initial JPEGs become quality-approved coverage frames only; the client no longer uses local wrist events or local repetition candidates to label evidence. Exact finding frames remain requested later by the server.

Progress shows neutral stages such as "Mapping visible movement" and "Checking requested movement evidence." It does not claim that 3D measurements are exact.

## Compatibility

- Historical video-only sessions remain valid.
- Historical version-2 pose summaries remain readable for old results but never enter the new query evaluator.
- New sessions use the version-3 artifact and manifest.
- If a development client lacks the native module, analysis remains video-only.
- Existing result payloads remain valid because measurement evidence IDs are optional.

## Validation and release gate

Unit tests use synthetic landmark fixtures to prove that the index preserves raw values, query operations work for arbitrary joint names, missing data is not interpolated, invalid plans fail closed, and no exercise or fault vocabulary appears in the processor.

Integration tests cover signed artifact upload, path ownership, resumable stages, planner failure fallback, query-result grounding, exact-frame continuation, reanalysis, and deletion.

Release remains shadow-first. The same labeled recordings are compared with and without requested pose evidence. Assist is enabled only if recognition, repetition interpretation, finding agreement, timestamp accuracy, unsupported-claim rate, score stability, and latency meet the benchmark gates. Requested 24 FPS and estimated world coordinates are reported as provenance, not guaranteed accuracy.
