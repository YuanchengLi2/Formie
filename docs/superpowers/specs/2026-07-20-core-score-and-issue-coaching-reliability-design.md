# Core Score and Issue Coaching Reliability

Date: 2026-07-20

## Goal

Make the existing Formai submission flow reliable enough to release: every viewable workout submission completes with an honest numeric score and useful coaching, and every identified issue clearly explains what happened and what to do next.

This work strengthens the current analysis path. It does not add another model pass, reviewer, workflow, or user-facing setup step.

## Required behavior

For every submitted video that contains a viewable workout:

1. Return a numeric overall score.
2. Return at least one useful next-set action.
3. Return every supported issue with all three user-facing parts:
   - Issue: a short title naming the problem.
   - What happened: a literal description of the visible movement and, when supported, where or how often it happened.
   - What to do next: a concrete instruction, a short cue, and a success check.
4. Preserve the current results interface and its left/right arrows for moving between issues.
5. Never leave a completed result with a missing score, an empty coaching panel, or an issue whose explanation or correction belongs to another issue.

Blank, corrupt, unreadable, or non-workout uploads may return a recording error. Ordinary uncertainty, an unfamiliar exercise, or incomplete criterion coverage must not cause a viewable workout to be rejected.

## Core scoring behavior

The existing criterion analysis remains the source of the score. The score path will become total for viewable workouts:

- Supported `good`, `minor_issue`, `important_issue`, and `major_issue` assessments retain their existing severity weights.
- The raw supported-criterion score remains the primary performance measurement.
- The score is coverage-calibrated toward a neutral baseline of 75 when only a small portion of the selected criteria is visibly supported. This prevents one visible good criterion from producing an unjustified 100.
- When no selected criterion is supported but a workout is visibly occurring, the score is 75 instead of `null`. This is a rare last-resort score, not a separate analysis layer.
- Existing issue-based ceilings remain authoritative so an important or major supported issue cannot be hidden by several good criteria.
- Completed scores are clamped to the public 0-100 range. A perfect-looking set is allowed to score highly, but sparse evidence alone cannot produce 100.

The coverage calibration is deterministic:

```text
coverage = supported criterion weight / selected criterion weight
calibrated score = raw supported score * coverage + 75 * (1 - coverage)
```

If selected criterion weight is unavailable, the scorer uses the supported score when present and 75 otherwise. Issue ceilings are applied after calibration.

The score is a judgment of the visible performance, not a claim that every possible fault was checked. The app must not invent a fault merely to justify the score.

## Per-issue coaching contract

Each supported correction is one stable finding with a single identifier. Its fields must describe the same issue:

- `title`: issue name shown above the carousel.
- `detail`: the “What happened” text, grounded in visible evidence.
- `actionableCorrection.instruction`: the main “What to do next” action.
- `actionableCorrection.cue`: a short cue usable during the next set.
- `actionableCorrection.successCheck`: what improvement should look or feel like.
- `evidence`: frames, timing, repetitions, or confidence already supported by the analysis.

The assembly layer may normalize wording, but it may not create a new unsupported biomechanical claim. If optional cue or success-check text is absent, deterministic wording derived from the same correction will fill it. A finding with no grounded `detail` or no actionable instruction is invalid and cannot be shown as a completed issue.

When no correction is supported, the result still contains useful coaching: preserve a visible strength, repeat a successful movement feature, or make a safe next-set refinement. The system must not manufacture a negative issue just to populate the carousel.

## Existing results UI

The current arrow-based interaction stays in place.

For each issue selected by the arrows, the result screen shows:

1. **Issue** — the finding title and issue count in the existing carousel header.
2. **What happened** — the observation for that exact finding.
3. **What to do next** — the correction, cue, and success check for that exact finding.

Changing arrows changes all three pieces together by finding identifier. The overall score remains at the top of the result and does not change while browsing issues. The finding detail screen uses the same data rather than maintaining a second version of the coaching.

## Server and client invariants

The core result is considered complete only when:

- `score` is a finite number from 0 through 100;
- `nextSetPlan` contains at least one useful action;
- every priority correction has a non-empty title, grounded “What happened” detail, and actionable “What to do next” instruction;
- the saved payload and the payload returned by the status route agree.

The server enforces these conditions before persisting a completed result. The client schema enforces the same conditions before rendering one. Resume, reanalysis, and saved-result paths all consume the same normalized result contract.

## Failure behavior

Only uploads that cannot be meaningfully analyzed as workout footage return an unable/error result, including:

- blank or entirely dark media;
- corrupt or unreadable media;
- no visible exercise or human workout movement.

These results do not fabricate a score. All other viewable workout submissions use the scoring fallback and coaching fallback inside the existing core pipeline.

## Verification

Automated tests must cover:

- a viewable workout with zero supported criteria returns score 75 rather than `null`;
- partial criterion coverage is calibrated and cannot become an unsupported 100;
- important and major issue ceilings still apply after calibration;
- complete/partial analyzed results with `score: null` are rejected by the server and client schemas;
- completed results without a next-set action are rejected;
- every correction must have issue, “What happened,” and “What to do next” content;
- moving through multiple carousel issues keeps the three displayed pieces tied to the same finding;
- no-correction results show a useful preservation/refinement plan without inventing an issue;
- upload, resume, reanalysis, status, and saved-result paths all preserve the score and coaching contract.

The live exercise matrix release check is:

- 100% of viewable workout submissions return a numeric score;
- 100% return useful next-set coaching;
- 100% of identified issues contain the three required pieces;
- known better executions generally outscore known worse executions across the matrix;
- blank/corrupt/non-workout media produces an explicit recording error instead of a fabricated result.

The benchmark is used to judge whether scores are directionally accurate and coaching is reliably useful. Exact fault-label agreement is not required for release.
