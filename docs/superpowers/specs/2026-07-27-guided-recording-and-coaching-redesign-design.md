# Formie Guided Recording and Coaching Redesign

## Status

Approved visual direction, with the coaching presentation revised to use the same three-part format for every finding.

## Goals

- Reduce the marketing homepage to Hero, Pricing, How It Works, and Coaching.
- Fix artwork overflow at the layout boundary instead of hiding page overflow.
- Ask for the exercise before recording and use the chosen catalog identity throughout capture and analysis.
- Let the user skip preselection and supply the exercise after recording.
- Avoid asking for the exercise twice.
- Require at least four genuine form corrections in every complete analysis.
- Add every other distinct, evidence-backed coaching issue Gemini finds without allowing those findings to replace the four form corrections.
- Present every correction using separate “What happened,” “Why it matters,” and “What to do next” fields.

## Marketing Website

The homepage order is:

1. Hero
2. Pricing
3. How It Works
4. Coaching
5. Legal footer

The standalone Setup Guide and Support homepage sections are removed. The header contains only Pricing, How It Works, and Coaching navigation plus the existing download state. Privacy, Terms, and the support destination remain available from the footer.

Marketing artwork must stay inside a bounded responsive canvas. Mobile rules must not make section images wider than their container or depend on negative horizontal margins. Each composition uses an overflow-clipped wrapper, a width no greater than the available inline size, and a dedicated mobile crop or internal transform when necessary. Validation covers 320 px, 390 px, 768 px, and desktop widths with no horizontal page overflow.

## Recording Flow

### 1. Choose Exercise

Selecting Record opens a new exercise-selection screen before the camera.

- The primary control searches the existing exercise catalog.
- Results show the exact exercise name and useful variation context.
- A selected catalog exercise stores its catalog ID, canonical label, and source.
- The user can change the selection before continuing.
- “Skip for now” remains visible and takes the user forward without inventing an exercise identity.
- If catalog search fails, the screen offers retry, custom entry, and skip instead of blocking recording.

### 2. Exercise Guide

After a catalog exercise is selected, Formie shows a short, exercise-specific preparation screen.

- Setup instructions cover the starting position, visible equipment setup, grip or contact points, and space required.
- Execution instructions describe the intended movement path and control.
- A safety note contains only broadly supported, exercise-relevant precautions and does not claim that injury will be prevented.
- The primary action opens the camera.
- The user can return to change the exercise.

Skipping exercise selection bypasses this exercise-specific guide and continues with generic camera-framing guidance.

### 3. Camera

The chosen exercise context remains in capture state while the camera records the set. Retaking the recording preserves that exercise context unless the user explicitly changes it.

### 4. Set Details

The post-recording screen begins with the recorded-video preview.

When an exercise was selected before recording:

- Show the exercise as a compact confirmed row.
- Provide a Change action.
- Do not render another exercise-name input.

When selection was skipped:

- Ask “Which exercise was this?”
- Use the same searchable catalog.
- Permit a custom typed exercise when no catalog result matches.
- Require an exercise identity before analysis begins.

The remaining set details are:

- Reps or seconds
- Total or per-side count when relevant
- Bodyweight, known weight, or unknown load
- Weight value, unit, and scope when known
- Optional side, tempo/style, and focus note under a secondary details disclosure

The submitted set declaration is the canonical exercise context for fresh analysis and later reanalysis.

## Analysis and Coaching Contract

### Form Corrections

Every complete analysis contains at least four distinct, evidence-backed form corrections. These corrections concern visible movement execution, including path, range, tempo, control, alignment, symmetry, stability, transitions, and repeatable endpoints.

Load, equipment, surroundings, grip, support, starting setup, posture/setup observations, and safety findings do not satisfy the four-form-correction minimum unless the same visible issue is specifically an active movement-execution fault. One issue belongs to one group and is never duplicated to inflate either group.

If the recording cannot honestly support four distinct form corrections, the analysis must report that the recording is insufficient rather than inventing problems or counting supplemental findings as form corrections.

### Additional Corrections

After the required form corrections, Gemini returns every other distinct correction supported by the recording. Supplemental categories include:

- Weight or load selection
- Starting posture and setup
- Equipment configuration or movement
- Visible safety and surroundings
- Grip and equipment contact
- Stance, support, and balance

There is no artificial display target for supplemental findings. Zero is valid when no additional issue is visible; otherwise every distinct supported issue is returned. Neutral or positive observations remain strengths or context and are not rewritten as problems.

### Coaching Format

Every form correction and every additional correction uses the same visible structure:

1. **What happened** — an objective description of the visible issue and, when supported, where it occurs across the set.
2. **Why it matters** — one practical consequence tied to control, repeatability, stability, range, setup, or a visible safety consideration.
3. **What to do next** — one specific action for the next set.

The three fields must have separate jobs. They must not repeat the same observation in different words, add unsupported anatomy or injury claims, or introduce a new issue. The complete visible coaching for one finding stays concise, normally three to four sentences total.

Each finding retains its video evidence and timestamp so the user can return to the exact visible moment.

## Results Presentation

Results display two ordered groups:

1. **Form corrections** — the required four or more movement-form findings.
2. **Additional coaching found** — all supported load, posture/setup, equipment, safety, surroundings, grip, support, and balance corrections.

The six-domain coverage audit can remain an internal completeness check, but the six domain cards are removed from the visible results screen. The old large post-analysis exercise guide is removed because exercise preparation now happens before recording.

Each correction card shows its title followed by What happened, Why it matters, and What to do next. Selecting its evidence returns the video to the supporting moment.

## State and Data Flow

Exercise choice is represented once in capture state and later promoted into the submitted set declaration.

- Catalog choice: catalog ID, canonical label, and `catalog` source
- Custom fallback: typed label and `custom` source
- Skipped state: explicit absence until post-record completion

The upload and analysis request read only the completed declaration, preventing the pre-record picker and post-record form from producing conflicting exercise names. Reanalysis reuses the saved declaration unless the user explicitly changes it.

## Error Handling

- Empty search does not make a network request.
- Search errors preserve the current query and offer retry, custom entry, or skip.
- A stale or removed catalog item can be converted to a custom label with a clear notice.
- Analysis cannot start without completed amount, load state, and exercise identity.
- Retake preserves exercise context and clears only recording-specific state.
- Resetting the entire capture flow clears both the recording and exercise context.

## Validation

### App

- Selecting an exercise before recording removes the post-record exercise input.
- Skipping requires exercise selection or custom entry after recording.
- Changing a preselected exercise updates the single canonical declaration.
- Retake preserves the preselected exercise.
- Fresh analysis and reanalysis receive the same declaration shape.
- A complete result cannot pass validation with fewer than four form corrections.
- Supplemental corrections cannot count toward the form minimum.
- All supported supplemental corrections survive schema parsing and render.
- Every finding renders What happened, Why it matters, and What to do next without repeated roles.

### Website

- Only Hero, Pricing, How It Works, and Coaching remain as marketing sections.
- Header anchors target the surviving sections.
- Pricing remains “10 analyses. $10.”
- The production build and lint pass.
- Browser checks at 320 px, 390 px, 768 px, and desktop show no horizontal overflow or clipped artwork.
