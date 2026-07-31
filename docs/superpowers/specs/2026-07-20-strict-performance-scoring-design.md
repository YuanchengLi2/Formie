# Strict Performance Scoring Design

## Goal

Make every viewable workout score reflect the quality actually visible in that set. A score of 95 is reserved for genuinely excellent execution across the visible criteria, not merely the absence of a verified correction.

## Core behavior

- The existing independent criterion verifier assigns a `performanceScore` from 0 through 100 for every visible criterion. This is part of the existing verifier response and does not add a model call or pipeline stage.
- Calibration bands are strict: 90–100 exceptional, 80–89 good with small visible imperfections, 70–79 acceptable but inconsistent, 50–69 clear repeated faults, and 0–49 major breakdown.
- `insufficient` criteria do not receive a performance score and contribute only through the existing neutral-coverage calibration.
- The deterministic scorer uses verified per-criterion performance values, criterion weights, observable coverage, and existing severity caps.
- A verified correction overrides a conflicting optimistic value by capping that criterion to the deterministic severity value.
- Legacy in-progress sessions without `performanceScore` retain the existing outcome/severity mapping so deployment remains resumable.
- The public score rationale reports each domain's verified performance score and coverage.

## Safety and reliability

- Scores remain deterministic after the verifier response.
- Scores remain numeric for every viewable workout and absent only for genuinely unable uploads.
- The verifier cannot see the analyst's score or coaching.
- No additional rejection path, setup check, model, or tracking system is introduced.

## Validation

- Unit tests cover parsing, clamping, legacy compatibility, weighted scoring, severity conflict handling, sparse evidence, and the 95 ceiling.
- The full Jest suite and TypeScript check must pass.
- Deploy `analyze-video`, confirm the active version, and run the entirely new matched good/bad exercise matrix.
