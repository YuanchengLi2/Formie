# Pre-Build-34 Paywall and FPS Benchmark Design

## Goal

Ship the exact newer paywall that existed in the main working tree before TestFlight build 34, repair the purchase interaction at its source, and use one saved near-15-second recording to compare Gemini analysis at 4, 8, and 12 FPS with high reasoning before selecting a production configuration.

## Confirmed paywall source

Build 34 was created from an isolated clean worktree containing the billing lifecycle fix, so it omitted the newer uncommitted paywall files in the main checkout. The intended paywall is the existing `paywall-reference-no-social-proof.png` composition and its matching native overlay in `premium-screen.tsx`:

- the reviews/social-proof section is absent;
- the plan box is taller and contains the product benefits and secure-payment line;
- the gold `Continue with Pro` CTA is below and outside the plan box;
- the CTA is a native `Pressable`, not text baked into the screenshot;
- the only purchasable plan is the live monthly RevenueCat package.

The shipped build-34 screen used `paywall-reference-latest.png`, where the button was baked into the image. Its transparent touch target was positioned at roughly 69 percent of the viewport while the drawn button appeared around 77 percent down the source image. The visible control and interactive control therefore diverged after full-screen scaling. The repair removes that architecture: the native button becomes both the visible surface and the touch target.

## Paywall behavior and layout

`src/screens/onboarding/premium-screen.tsx` will retain the pre-build-34 artwork geometry already present in the working tree. The full 852 by 1846 reference artwork scales proportionally to the phone width. The native status area masks screenshot chrome, the back control uses a native hit target over its intended location, and the content can scroll only enough to expose the bottom CTA on short devices.

The native CTA will be positioned from the approved source frame but rendered independently of the bitmap. Pressing it will call `onPurchasePlan("monthly")` when that callback is available and fall back to `onPurchase` only for older callers. During purchase reconciliation, the button stays opaque, becomes disabled, and shows progress. In `sync_required`, it invokes the receipt reconciliation action instead of creating a second purchase.

`assets/production/paywall/reference/paywall-reference-no-social-proof.png` remains the visual source. The review-containing `paywall-reference-latest.png` will no longer be referenced by the production screen, but it will not be deleted because it is existing project history and may be useful as a comparison artifact.

## FPS benchmark

The benchmark will use the most recent saved analysis input whose duration is closest to the 15,000 ms server limit. One script will download that exact stored video once and submit three otherwise identical Gemini analyst requests:

- Gemini 3.6 Flash;
- high reasoning;
- high media resolution;
- the same declaration, problem-finder prompt, JSON schema, temperature, and video bytes;
- FPS as the sole changed input: 4, 8, then 12.

Each run will preserve the raw structured result and report wall-clock latency, prompt tokens, output tokens, thinking tokens, and estimated provider cost using the repository's Gemini pricing function. A deterministic evaluator will compare detected problems, evidence timestamps, confidence, specificity, and cross-run agreement. This is an engineering comparison, not a claim of clinical or biomechanical ground truth; any existing benchmark expectations for the chosen session will be reported separately.

The benchmark calls Gemini directly through the existing request builders. It will not deploy three Edge Function variants, mutate production session state, consume user quota, or overwrite saved analysis results.

## Production configuration

The primary `analyze-video` pipeline currently reads the shared 12-FPS setting, while the isolated V49 path hard-codes 4 FPS. After the comparison, both active paths will consume a single shared analyst configuration so they cannot silently diverge. The selected FPS will be explicit, validated as supported, recorded in telemetry, and covered by configuration and request-construction tests. High analyst reasoning and high media resolution remain unchanged unless the benchmark exposes a provider incompatibility.

Because the user requested 12 FPS, 12 FPS is the intended production selection. The benchmark is a verification gate: if the 12-FPS response is valid and materially at least as useful as the lower-FPS runs, the shared production value will remain 12. If it fails, regresses quality, or creates disproportionate latency/cost, the measured evidence will be presented before selecting a different value.

## Validation

Paywall tests will prove that the no-social-proof asset is selected, review copy is absent from accessibility output, the plan artwork keeps its approved aspect ratio, the CTA sits outside the plan box on representative phone sizes, and pressing the visible CTA calls the monthly purchase handler. Billing tests will prove the press reaches the purchase/reconciliation boundary and that unavailable or reconciling states remain intentionally disabled.

Analysis tests will prove 4, 8, and 12 are accepted benchmark inputs, every comparison request retains high reasoning and high resolution, the shared production configuration resolves to the selected FPS in both analysis paths, and cost aggregation includes prompt, output, and thinking tokens. The final verification set will include focused Jest/Vitest suites, the benchmark runner on the saved clip, and `npx tsc --noEmit`.

## Scope and safety

Existing unrelated dirty-tree changes will not be reset, rewritten, or included in scoped commits. No banking, tax, App Store agreement, provider secret, service-role key, or user video bytes will be printed. Benchmark output will identify the source only by an anonymized label and duration. A new TestFlight build will be created only after the implementation and verification evidence is complete.
