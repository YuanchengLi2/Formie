# Plain-Language Coaching Design

## Goal

Make Formie's coaching easier to understand without making it generic, removing useful exercise terminology, or changing which form issues the analyst identifies.

## Scope

Change only the whole-video coaching writer instruction in `supabase/functions/_shared/boundary-free-analysis.ts` and its prompt-contract tests in `supabase/functions/_shared/boundary-free-analysis.test.ts`. Do not change the analyst prompt, issue selection, evidence, scoring, sentence counts, result schema, or user interface.

## Writing contract

The writer will:

- Prefer short sentences and familiar gym language.
- Use a technical term only when it makes the coaching more accurate or useful.
- Explain an uncommon technical term immediately in everyday words instead of stacking jargon.
- Keep every statement specific to the declared exercise, the recorded set, and visible video evidence.
- Preserve the existing output shape: a short title, exactly three sentences for What happened, exactly three sentences for Why it matters, and one direct next-step sentence.
- Preserve the analyst's finding IDs and facts without inventing observations.

The writer will not be given a rigid sentence template or a banned-word list. This leaves room for natural variation while establishing a clear readability target.

## Data flow and failure behavior

The validated analyst output continues to pass unchanged to the coaching writer. Only the instruction governing display language changes. Existing stage leases, retries, saved analyst-output recovery, and result persistence remain unchanged.

## Verification

Update the prompt-contract test first so it fails until the writer instruction explicitly requires mostly everyday language, shorter sentences, and immediate plain-language explanations for uncommon technical terms. Then run the focused prompt tests, the full analysis suite, and TypeScript checking. Deploy `analyze-video` only after those checks pass, because the writer instruction executes server-side.
