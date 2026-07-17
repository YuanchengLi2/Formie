# Formai Brand and Whole-Set Analysis Design

## Goal

Use the supplied purple movement-analysis artwork as FORM's application identity and make complete-set context an explicit, testable input to analysis results and coaching.

## Scope

This change covers application branding assets, the primary Gemini video-analysis contract, persisted analysis results, Results presentation, Coach context, automated verification, Supabase deployment, and merging the completed feature branch into local `master`.

It does not add pose tracking, frame extraction workers, monocular 3D reconstruction, or a standalone fatigue detector. The original uploaded video remains the authoritative source.

## Branding

The supplied PNG at `C:\Users\yuanc\Downloads\ChatGPT Image Jul 17, 2026, 05_24_11 PM.png` is the source of truth. Derived assets will preserve its purple field, white athlete and framing marks, and red joint accent.

The asset pipeline will produce:

- a full launcher icon for iOS and general Expo use;
- an Android adaptive foreground with sufficient safe-area padding;
- an Android background coordinated with the supplied purple;
- an Android monochrome mask suitable for themed icons;
- a splash mark and web favicon; and
- an in-app brand image where the existing interface displays a visual FORM mark.

Generated assets must be inspected at their rendered sizes so platform masking does not crop the person or frame corners.

## Whole-Set Video Analysis

The primary Gemini request will continue to contain the complete original video file before the text prompt. It will use the configured 18 FPS sampling rate and high media resolution without start or end offsets. Focused offsets remain available only for a single material uncertainty after the primary pass.

Before producing coaching, the model must reason through:

- exercise and variation identity;
- the available camera view and visible movement references;
- setup, every distinguishable repetition, resets, and partial footage;
- the same movement phase across early, middle, and late repetitions;
- body, implement, cable, plate, pad, and machine travel that is relevant to the exercise;
- changes in timing, range, endpoint, stability, sequencing, or symmetry across the set; and
- the whole-set evidence that most directly supports the next-set advice.

This context is not a fatigue classification. Repeated later-set deterioration may inform coaching, but one poor rep must not be generalized to the whole set.

## Structured Set Context

New analyses will return a required `setContext` object alongside `setSummary` and `repTimeline`. It will contain concise structured fields for:

- the observed camera view;
- visible reference points used for reasoning;
- a sequence summary spanning the full recording;
- the meaningful change, or consistency, across the set; and
- the visible evidence basis used to prioritize coaching.

The model-facing schema will require this object for new complete or partial results. Client parsing remains backward compatible with older saved results by supplying a neutral default when the field is absent.

`setContext` will be stored as JSONB in `analysis_results`, returned by analysis status, and included in the complete analysis object supplied to coaching chat.

## Front and Down-Front Depth Reasoning

A single camera cannot provide trustworthy metric 3D depth. FORM will instead extract qualitative relative-depth evidence that the view visibly supports, including:

- shoulder, elbow, hand, or implement travel relative to stable equipment edges;
- the endpoint of a handle, lever, plate, cable attachment, or machine carriage;
- body-to-machine spacing and contact with pads or supports;
- occlusion order and overlap changes;
- apparent scale changes used cautiously; and
- repeated endpoint comparisons at the same exercise phase.

The model may say that travel shortened, an endpoint shifted, or one side reached a different visible position. It must not invent exact depth, distance, force, velocity, or joint angles. Perspective ambiguity belongs in analysis limitations without discarding other usable evidence from that view.

## Results and Coaching UX

Results will show a compact "Whole-set read" derived from `setContext`, complementing the existing score, findings, rep timeline, and playback markers. The section will emphasize the sequence-level observation and its coaching basis without adding camera setup advice to the coaching itself.

Coach chat will continue to use the selected recording and saved analysis. Its backend prompt will explicitly receive `setContext`, `repTimeline`, findings, evidence moments, and the user's selected evidence marker. Answers must distinguish a set-wide pattern from an isolated event and cite only relationships supported by the recording.

Older analyses without `setContext` remain readable and coachable through the backward-compatible default.

## Failure Handling

- If the video is unusable, the existing unable flow remains authoritative.
- If a usable analysis omits or malforms `setContext`, structured-output validation triggers the existing retry path.
- If the view cannot resolve a depth question, the result states that limitation and coaches from other visible relationships.
- If a focused premium review fails, the validated primary whole-video result remains available.

## Testing and Verification

Development follows red-green-refactor tests for:

- exact whole-video Gemini request metadata;
- required structured set context and backward-compatible client parsing;
- full-set and relative-depth prompt rules;
- database/result payload mapping;
- coach-chat inclusion of whole-set context;
- Results rendering of the whole-set read;
- correct Expo asset configuration and generated dimensions; and
- unchanged behavior for older saved results.

Completion requires the full Jest suite, TypeScript, lint, Expo Doctor, Android export, migration parity, active Supabase function versions, a live Expo tunnel, and a QR generated from the exact live redirect.

## Delivery

All intended application, function, migration, test, and brand-asset changes will be committed on `codex/formai-motion-polish`. Generated export directories will not be committed. After verification, the feature branch will be merged into local `master` with no destructive reset of existing work.
