# Four-Problem Coaching and Muscle Visualization Design

## Goal

Every new analysis and saved-video reanalysis must produce clear, personalized coaching grounded across the complete exercise. The three-tab coaching selector must show at least four genuine visible problems, while the results page retains the exercise-only playback window, ranked summaries, and separate strengths.

## Coaching topic contract

For every usable or partially usable recording, the analyst must return at least four distinct, evidence-backed problems. A problem may concern:

- movement technique, position, path, range, control, tempo, or symmetry;
- setup, stance, posture, support, or grip;
- visible equipment movement or configuration;
- readable or unreadable load information when it changes the usefulness of the next-set recommendation;
- a specific visible safety problem or a smaller optimization opportunity.

Corrections remain the first priority. When fewer than four major technique errors exist, the analyst must inspect the broader categories above for lower-severity but still genuine and actionable problems. It must not turn strengths into problems, duplicate one issue under several names, invent hidden muscle activation, or add generic safety warnings unsupported by the recording.

Each displayed problem needs timestamped evidence inside the active exercise interval. Recurring problems use supported moments from separated parts of the set; isolated problems are described as isolated. The deterministic order remains severity, recurrence, then analyst source order.

Strengths remain separate under What You Did Well and never appear in the problem slider or count toward its four-problem requirement.

## Coaching writing

The writer receives the immutable full-set analyst result and writes one canonical entry for every genuine problem:

- `whatHappened`: an objective, video-specific explanation, normally one to three sentences;
- `whyItMatters`: one clearly taught movement concept, normally two to three sentences;
- `whatToDo`: one memorable next-set cue, normally one to two sentences.

The ranges guide the writer but do not truncate valid copy. Each entry must name the visible body, implement, grip, setup, equipment, or load relationship that actually occurred and must use the supported full-set pattern. The three tabs cannot repeat the same sentence or paraphrase a generic prompt.

The Whole Set Summary remains exactly three sentences. Coach's Note remains dynamically sized and synthesizes the person's strongest pattern, most important progress target, and what improvement should visibly look like.

## Results experience

The top workspace remains score, exercise-only video, and the three coaching tabs. Its counter changes from `Issue N of M` to `Problem N of M`, and every slider item is a genuine problem.

Below the workspace, the order remains:

1. Whole Set Summary
2. Exercise Muscle Focus visualization
3. Coach's Note
4. What You Did Well
5. Weaknesses ranked as Priority 1, Priority 2, and so on
6. Your Next Set actions aligned with those priorities
7. Comparison and existing actions

All supported problems appear in Weaknesses and receive a matching next-set action. Removed helper subtitles and the Camera visibility note stay removed.

## Muscle visualization

Replace the plain muscle list with a front-and-back anatomical body image and labeled legend.

- Green indicates the declared exercise's primary intended target muscles.
- Red indicates normal secondary or supporting muscles also trained by the declared exercise.
- The visualization never claims that the video proved muscle activation, compensation, pain, or internal loading.

The writer returns structured primary and secondary muscle groups using a bounded region vocabulary. The UI maps those regions to overlays on the anatomical image and also prints the muscle names for accessibility. Historical array-only `muscleFocus` values remain readable as an unclassified text list until reanalysis.

The persisted `muscle_focus` JSON column changes from array-only validation to a versioned structured object while retaining compatibility with historical arrays.

## Recording and reanalysis consistency

Fresh recordings and saved-video reanalysis must use the same new pipeline version and contracts. Saved-video reanalysis deletes the prior result, clears the analyst draft and writer copy, preserves or replaces the authoritative set declaration, and regenerates all coaching, muscle, and playback-window data.

Record Another may still route through recording tips before capture, but the newly created session must use the same current pipeline. No historical two-item coaching result may be copied into the new session.

## Exercise-only playback and frames

Gemini continues receiving the complete upright recording. The results response derives a bounded window from `activeSetStartMs` through `activeSetEndMs`.

Stored evidence remains in original-video coordinates. The player converts source timestamps into exercise-relative labels and marker positions, converts exercise-relative seeking back into source timestamps, begins at the first exercise frame, pauses at the final exercise frame, and restarts at the exercise beginning. Evidence frames selected by the AI remain aligned after clipping because only presentation coordinates change.

Historical results without a valid window continue using full-video playback.

## Failure and validation behavior

Structural validation rejects analyzed results with fewer than four problems, duplicated IDs, timestamps outside the active interval, invented recurrence, unsupported internal-mechanics claims, or writer attempts to add or remove analyst problems.

The analyst performs a final category audit before finishing. If the recording is too incomplete to support four honest problems, it returns `unable` with a specific recording instruction instead of fabricating advice or showing an undersized slider.

## Verification

- Contract tests prove at least four distinct supported problems survive analyst parsing, writer copy, persistence, API parsing, slider rendering, weakness ranking, and next-set alignment.
- Tests prove strengths and generic filler never enter the problem slider.
- Prompt tests cover technique, setup, grip, equipment, load, safety, and optimization audits.
- Writer tests verify personalized beginning/middle/end references, distinct tab content, flexible length, and no truncation.
- Reanalysis and fresh-recording tests prove both paths select the current pipeline and do not reuse historical results.
- Muscle tests cover structured persistence, legacy arrays, front/back region mapping, colors, labels, and accessibility.
- Playback tests cover source/clip conversion, marker placement, selection, seeking, start/end boundaries, completion restart, and legacy fallback.
- Full Jest, TypeScript, Expo lint, and `git diff --check` remain required.
