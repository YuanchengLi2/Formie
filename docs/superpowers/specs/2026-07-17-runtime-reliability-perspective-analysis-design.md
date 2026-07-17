# Formai Runtime Reliability and Perspective Analysis Design

## Goal

Repair the recording, analysis-progress, coaching-detail, and playback failures while keeping one primary Gemini full-video analysis pass. Add a branded image-generated movement animation and require the model to account for camera direction, foreshortening, overlap, apparent scale, and perspective distortion before giving technique advice.

## Confirmed causes

- The camera currently uses a 30-second hard stop while the rest of the app accepts longer metadata. The latest affected bench recording ended at 30.18 seconds before repetitions began, so Gemini correctly analyzed only setup, unracking, and a static hold.
- `analyze-video` persists several stage changes inside one long HTTP request. React Query cannot observe those intermediate database states while that request remains in flight.
- Results build review points from corrections and cues only, and hide most of `nextSetPlan`, making a three-observation result look like two pieces of coaching.
- Finding IDs are not validated as unique and the detail route receives only the finding, so every page uses the same generic structure without set or rep context.
- Playback polls the player every 120 milliseconds and uses mixed gesture coordinates for tap and drag release, causing visible jitter and incorrect seeks.

## Recording integrity

Allow recordings up to 90 seconds, with manual stop remaining the normal completion path. Align the camera setting, duration normalization, API validation, and database constraint. The uploaded storage object remains the authoritative original file; the app must never intentionally crop or trim it before the Gemini Files API upload.

## Observable analysis stages

Convert the analysis handler into a persisted state machine. Each invocation performs one durable transition and returns `202`, allowing the client to render:

1. securing the recording;
2. checking the recording;
3. preparing the complete video;
4. reviewing visible technique;
5. preparing coaching.

Store the validated primary Gemini draft in `analysis_sessions.analysis_draft` between technique review and optional precision verification. This does not add a Gemini request. Clear the draft when the final result is saved.

## Whole-video and perspective-aware coaching

Keep the existing single primary request with the entire Gemini file, 18 FPS sampling, high media resolution, and no start or end offsets. Strengthen the contract and prompt so that:

- known rep totals equal the number of rep-timeline entries;
- each finding ID is unique across strengths, corrections, and cues;
- each next-set action ID is unique;
- the model identifies camera direction as front, rear, side, high/low, or diagonal when supported;
- the model distinguishes observed movement from foreshortening, lens/perspective distortion, occlusion, overlap, and apparent-size change;
- symmetry and depth claims compare the same movement phase against stable body, equipment, pad, rack, or machine references;
- uncertain or hidden relationships are listed as limitations rather than invented;
- every independent visible and actionable issue remains separate instead of being merged to shorten the answer;
- the ordered next-set plan includes every supported action without filler.

No routine second pass, pose worker, or local motion model is added. The existing retry is used only when Gemini returns structurally invalid or internally inconsistent output.

## Results and detail experience

The coaching review includes strengths, corrections, and cues, and displays the complete ordered next-set plan. A detail route resolves both the finding and its section. The page uses severity and section labels, occurrence count, affected reps, visible body/equipment references, the selected evidence interval, nearby rep context, and whether the observation is isolated or recurring. Each page remains visually consistent while its information architecture changes according to the selected finding.

## Playback

Use Expo Video events for current time and playing state instead of a 120-millisecond polling timer. A tap seeks once using local track coordinates. A drag begins only after a movement threshold, previews without seeking, and commits one seek on release using measured page coordinates. Evidence markers remain independent press targets.

## Generated movement animation

Generate one four-panel, text-free sprite sheet in the existing dark, gold, violet, and white visual language. It will depict one consistent neutral athlete silhouette moving through four exercise phases while an analysis trace follows the visible body and implement. Native animation advances the cropped frames and layers the existing scan/progress state over them. Reduced-motion users receive a stable frame with stage changes still represented in text.

## Verification

- Unit tests cover 90-second duration limits, persisted stage transitions and draft resume, unique IDs, rep-count consistency, perspective prompt rules, all coaching points, issue-specific detail context, and stable tap/drag seeking.
- Full Jest, TypeScript, lint, Expo Doctor, and Android export must pass.
- Supabase migration and functions must deploy and report active.
- The current Expo tunnel and regenerated QR must be verified locally and externally.

