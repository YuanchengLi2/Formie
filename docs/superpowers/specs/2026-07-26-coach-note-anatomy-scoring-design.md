# Coach's Note, Anatomy Comparison, and Scoring Design

## Goal

Make the results screen compact, accurate, and fair. The Coach's Note area must preserve detailed exercise-specific scoring without competing for space with the written note. Muscle highlighting and the overall score must follow visible evidence rather than broad guesses or punitive caps.

## Coach's Note Panel

Use one full-width Coach's Note card with a two-button segmented control:

- **Scores** shows the overall score plus three to five exercise-specific category scores.
- **Coach's Note** shows the complete personalized note in the same card footprint.

The selected view occupies the full width of the card. Scores and note are never displayed side by side. The control is accessible as two tabs and defaults to Scores when category scores exist; otherwise it opens the note.

Category labels are chosen for the declared exercise and visible evidence. A shoulder press can use categories such as dumbbell path, torso stability, range, tempo, and wrist alignment. A squat, row, or curl receives different relevant categories. Each category contains a 0–100 score and a concise evidence-based observation.

Legacy stored movement scores remain readable. New analyses generate exercise-specific category scores again.

## Anatomy Comparison

Use one anatomy panel with two buttons:

- **Target Muscles** shows the muscles the exercise is intended to train in green.
- **Your Form** shows only anatomy regions tied to evidence-backed coaching findings in red.

Both views use the same rotatable model and preserve the horizontal rotation slider. Switching views does not reset rotation.

Muscle coloring must use explicit GLB mesh-name mappings. Broad aliases that can color unrelated muscles are removed. Primary and secondary targets come from the recognized or declared exercise. Red regions come only from finding-level `observedIssueRegions` supported by timestamped evidence. If no reliable red region exists, the Your Form view stays neutral and explains that no localized issue was identified.

## Summary and Coaching Copy

Strength cards in Whole Set Summary use green accents and positive iconography. Focus areas retain warning or red styling, and next-set actions retain the existing action styling.

Each visible coaching item is two to three sentences total across its bold opening and supporting copy. The title or bold opening is part of the total content budget; the UI must not append another two or three sentences beneath an already long heading. The three coaching tabs keep their separate jobs: observation, significance, and next action.

## Scoring

The overall score measures visible execution quality for the declared exercise:

1. Start from observed successful execution, not from a low default.
2. Apply deductions only for supported faults.
3. Scale deductions by severity, recurrence, confidence, and how much of the set is affected.
4. Treat isolated or minor deviations as small deductions.
5. Do not apply a severe global cap merely because two coaching opportunities are present.
6. Do not reward or penalize technique that the camera cannot show.

The overall score and category scores must agree. A technically sound set with minor refinements should remain in a strong range. Important or high-severity recurring faults can still reduce the score substantially when the evidence supports them.

## Data and Pipeline

The combined analyst-coach response includes three to five exercise-specific category scores. Deterministic validation checks:

- category labels are distinct and relevant to the exercise;
- scores are integers from 0 to 100;
- observations are supported by evidence;
- category and overall scores do not contradict finding severity;
- muscle regions use the supported anatomy vocabulary;
- every red issue region belongs to an evidence-backed finding.

Stored `movementScores` remains optional for backward compatibility. Reanalysis uses the same scoring and anatomy contract as fresh analysis.

## Testing and Acceptance

- Test the two Coach's Note tabs, default selection, and shared compact footprint.
- Test exercise-specific scores and legacy score rendering.
- Test the two anatomy views, preserved rotation, neutral no-issue state, and exact mesh mapping.
- Test green strength cards and the two-to-three-sentence coaching budget.
- Test proportional scoring for correct sets, minor isolated issues, and recurring major faults.
- Run TypeScript, focused Jest tests, lint, and scoring contract tests.
- Verify one fresh and one reanalyzed live result with relevant category scores, accurate target muscles, evidence-backed red regions, and an overall score consistent with the visible set.
