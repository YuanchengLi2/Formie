# Enforced Coaching Contract

## Goal

Every visible correction reaches the results UI as three or four short coaching sentences:

1. one sentence naming the visible error and when it occurred;
2. one sentence explaining its visible effect on path, range, control, stability, or repeatability;
3. one imperative sentence telling the user what to do next;
4. an optional one-sentence visible success check.

The saved result must not contain unsupported claims about muscles, leverage, internal forces, strain, joint loading, or hidden causes.

## Design

Add a deterministic coaching-contract normalizer at the analyst and writer parsing boundary. It will keep compliant model copy, reduce each required field to one sentence, reject non-visible causal language, require an imperative instruction, and produce a concise evidence-grounded fallback when copy is invalid. The fallback uses the correction's own visible detail, evidence phase or repetition, and movement-quality category; it never invents a new cause.

Apply the same normalizer when assembling public results so historical and partially compliant model output cannot bypass the contract. The UI continues to display separate What happened, Why it matters, and What to do next selectors and therefore needs no presentation redesign.

## Failure Behavior

Bad coaching copy must not fail an otherwise valid analysis. Invalid wording is replaced deterministically from the immutable finding and its evidence. Unsupported findings themselves remain governed by the existing evidence validator and are not converted into new corrections.

## Tests

- Reproduce the recent dumbbell-row failures: “bar path” for a dumbbell, muscle or leverage claims, and non-visible strain or joint-loading claims.
- Verify each correction produces exactly three or four sentences across the displayed fields.
- Verify What happened names the visible event and timing.
- Verify Why it matters is limited to visible movement quality.
- Verify What to do next is imperative.
- Verify the optional success check is one sentence and does not duplicate the instruction.
- Verify compliant coaching remains unchanged.
- Verify legacy five-sentence corrections are normalized when served.
