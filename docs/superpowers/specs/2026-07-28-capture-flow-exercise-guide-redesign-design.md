# Capture Flow and Exercise Guide Redesign

## Goal

Make the path from exercise discovery through recording and upload feel intentional, visual, and impossible to strand in an invalid capture state. Users who cannot find an exercise should be able to name it and receive the same AI-generated guide page as catalog exercises. Formie's video analyst must explicitly calibrate camera angle and camera-to-subject distance before judging visible technique.

## Capture Flow

The capture store remains the source of truth for the recording lifecycle.

1. Exercise selection records a catalog exercise, a custom exercise name, or an explicit skip.
2. The guide and recording setup screens operate only before a local recording exists.
3. Finishing a recording persists the local file and replaces the camera with Set Details.
4. Set Details cannot be dismissed with an iOS swipe or Android hardware back action while the recording is retained.
5. A prominent `Re-record this set` action appears directly below the recorded-video preview. It resets the upload coordinator, discards the retained take, and replaces Set Details with a clean camera.
6. Submitting valid set details starts upload and replaces Set Details with the upload progress route.
7. The camera never renders a retained `recorded` state as `Preparing upload`; if it is reached with a retained take, it returns to Set Details.

The existing bottom `Retake` action is replaced by the prominent preview-level action so there is one unambiguous rerecord path.

## Choose Exercise Screen

The screen title is `Choose Exercise`.

The layout contains:

- a gold `Skip` action in the top-right;
- a centered original Formie illustration of a gray athlete performing a bench press;
- helper copy beneath the illustration: `Choose an exercise if you need help`;
- the exercise search field and polished result cards;
- a clear empty-search action: `Can’t find your exercise? Let AI generate your guide.`

The empty-search action uses the user’s current search text as the custom exercise name. It requires a meaningful name between 2 and 120 characters. Selecting it stores a typed custom exercise choice and opens the guide route. A custom exercise is not silently converted into a catalog exercise.

## Generated Exercise Guide

Catalog and custom exercises use one guide screen and one response contract:

- setup steps;
- execution steps;
- safety steps;
- a YouTube tutorial action;
- camera-placement guidance.

Catalog guides continue using the existing cache. Custom guides are generated from the normalized exercise name and kept in the client query cache for the current flow; they are not written into the catalog cache.

The YouTube treatment is a large top card labeled for the selected exercise. Tapping it opens a YouTube search for `<exercise name> proper form tutorial`. Formie does not copy or redistribute third-party video frames.

The guide uses original Formie movement-family artwork. Existing production family assets are reused after visual QA, and missing or unsuitable assets are replaced with gray-and-gold illustrations. The section cards use the relevant family graphic with numbered step copy so the page is visual without generating new anatomy on every request. Custom guide generation returns a supported movement family used to select the closest illustration.

## API and State Changes

`exerciseChoice` gains a custom variant containing the normalized exercise name and generated movement family when available.

The exercise-guide request accepts exactly one of:

- `catalogExerciseId`; or
- `customExerciseName`.

The guide response adds:

- `exercise.family`;
- `cameraPlacement`;
- `youtubeSearchQuery`.

The server validates the custom name, generates the same bounded guide structure, and never treats generated instructions as a catalog identity. The client carries the custom name into Set Details as the authoritative exercise label.

## Camera-Perspective Analysis

The shared single-pass analysis prompt used by both fresh analysis and reanalysis will require an explicit perspective calibration before findings:

- infer camera height, viewing direction, and approximate camera-to-subject distance from stable scene references;
- account for foreshortening and oblique projection;
- compare body-relative and equipment-relative landmarks instead of raw screen-space slopes;
- avoid turning perspective distortion into a technique fault;
- lower confidence and record a limitation when distance or angle hides a dimension;
- never lower the technique score merely because of the recording viewpoint.

This changes the analyst’s reasoning instructions without adding unsupported numeric joint-angle estimates.

## Error Handling

- Empty or one-character custom names stay on Choose Exercise with an inline validation message.
- Guide-generation failures retain retry and continue options.
- YouTube opens only after a user tap and falls back to a browser search URL.
- Rerecording clears any prepared upload target before starting another take.
- A retained recording always resolves to Set Details, never a setup screen or inert camera overlay.

## Testing

Automated regression coverage will prove:

- Set Details exposes one prominent `Re-record this set` action;
- system back cannot leave Set Details while a take is retained;
- rerecord clears the take and upload coordinator before opening the camera;
- the camera redirects a retained `recorded` state to Set Details;
- empty exercise results expose the AI-guide action;
- a custom name reaches the guide request and survives into Set Details;
- catalog and custom guide requests are mutually exclusive and validated;
- guide cards render YouTube, family artwork, camera placement, and all step sections;
- the shared fresh/reanalysis prompt includes camera height, viewing direction, distance, foreshortening, and confidence rules.

Acceptance requires the relevant Jest suites, TypeScript validation, a successful iOS Metro bundle, and a real device pass through catalog selection, custom selection, rerecord, upload, and analysis.
