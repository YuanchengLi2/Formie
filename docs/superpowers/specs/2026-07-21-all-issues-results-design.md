# All-Issues Results Design

## Goal

The Results screen must show every distinct visible correction returned by the single Gemini video-analysis pass. A recurring mistake appears once as an issue, while all supporting timestamps remain in that issue's More Details screen.

## Analysis contract

- Gemini 3.6 Flash (`gemini-3.6-flash`) remains the only model that analyzes video and owns findings, score, severity, and evidence.
- Send the complete original video at exactly 16 FPS, high media resolution, and `thinkingLevel: "high"`.
- The analyst audits setup and stability, path and alignment, range and positions, control and tempo, and repetition consistency.
- Every distinct clearly visible deviation becomes one correction finding, including minor issues.
- The analyst must perform a final small-issue sweep and retain note-level deviations even when a larger issue is also present.
- Repeated occurrences of the same deviation remain one finding with multiple evidence moments.
- The contract does not require an arbitrary minimum number of corrections; uncertain or invisible mechanics must not be invented.
- Every negative scoring observation must reference at least one correction finding. A dimension may be positive or not visible without creating a correction.
- The Lite writer remains wording-only and cannot add, remove, merge, or alter findings or evidence.

## Results screen

- Render the complete `priorityCorrections` array as an issue selector/list instead of showing only the currently selected priority issue.
- Each issue appears exactly once with its title, severity, concise correction, and one representative frame using the first evidence moment.
- Selecting an issue changes the video marker and coaching panel to that issue's representative frame.
- Tapping More Details opens the existing finding-detail screen.
- Do not render every recurring timestamp as a separate Results issue.
- Show the analyst's five score-rationale observations in a catalog-free "Why this score" section for new single-pass results.

## More Details screen

- Preserve the existing evidence-moment selector.
- Display every evidence timestamp for the selected issue there.
- Selecting a moment seeks the private original video to that moment's `peakMs`.

## Validation and tests

- Contract tests prove every negatively classified score dimension references a correction ID and every correction remains independently visible.
- UI tests prove all distinct corrections render on Results, recurring evidence does not duplicate issue cards, and More Details retains all evidence moments.
- Existing historical scorecard results remain readable, but no rubric or catalog is used by new analyses.
- Run focused tests, the full Jest suite, TypeScript, and lint before deployment.
