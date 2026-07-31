# Analyst-Coach Quality Design

## Goal

Keep one canonical analysis path: Gemini identifies the exercise and every visible issue from the full video, then a text-only coach writes three or four useful sentences for each issue.

## Verified current behavior

- The deployed `analyze-video` source matches this checkout.
- The latest row analysis used the original full video: `analysis_input_strategy = video`, with no analysis clip or source offsets.
- The analyst call used `gemini-3.6-flash`, high thinking, requested 12 FPS, and `MEDIA_RESOLUTION_HIGH`.
- The previous writer expanded each issue into multiple long sections.
- The latest row analyst's movement record incorrectly described the dumbbell path as traveling toward the lower torso. That mistaken movement record propagated into the final correction inventory.

## Design

The canonical pipeline is upload -> Gemini Files -> one `gemini-3.6-flash` full-video analyst call -> one text-only coaching writer -> validated result.

The analyst owns exercise recognition, movement interpretation, issue detection, evidence, timestamps, severity, and scoring. It must inspect the full movement before recognition and compare the implement path, moving body segments, torso position, support position, endpoints, tempo, and repetition consistency across beginning, middle, and end. It returns every supported issue without ranking or selecting a primary correction.

The coaching writer receives the immutable analyst result without video. It may improve wording only and cannot add, remove, merge, rank, or contradict findings. Each correction is limited to four displayed sentences: observation, visible importance, instruction, and success check.

The app ignores historical expanded writer copy and renders a fixed sentence budget per issue:

1. One sentence describing what visibly happened and when it recurred.
2. One sentence explaining the visible effect on path, position, control, stability, range, or repeatability.
3. One sentence giving the next-set action.
4. An optional fourth sentence defining the visible success check.

Existing recordings remain readable. Every new analysis and reanalysis uploads `video_path`, the original recording, to Gemini. Stored preprocessing metadata may remain for compatibility, but `analyze-video` never selects `analysis_video_path`.

## Verification

- Unit tests prove the pipeline makes one video analyst call and one text-only coaching writer call.
- Contract tests prove correction inventories require no ranking or primary correction.
- Presentation tests prove each issue has no more than four total sentences across the three coaching tabs.
- Wiring tests prove the analyst request remains `gemini-3.6-flash`, requested 12 FPS, high resolution, high thinking, and has no clip window.
- Wiring tests prove the Gemini upload always reads `video_path`, never `analysis_video_path`.
- A live reanalysis of the latest row video is required before claiming detection quality improved.
