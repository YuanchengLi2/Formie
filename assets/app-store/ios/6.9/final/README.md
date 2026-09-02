# Formie 1.0 final screenshot order

Upload these images from left to right in this exact order. Every image must be a 1290 x 2796 PNG captured or composed from the corrected production build.

1. `01-benefits-overview.png` - angled-phone overview and core benefit. Ready; visually verified at 1290 x 2796 and flattened to RGB with no alpha/transparency. It contains no medical diagnosis claim.
2. `02-record-a-set.png` - exercise selection and silent camera-recording step.
3. `03-analysis-in-progress.png` - AI-processing consent followed by analysis progress; do not imply that data uploads before consent.
4. `04-evidence-linked-correction.png` - completed evidence-linked correction and external YouTube tutorial presentation.
5. `05-progress-and-next-set.png` - progress and the next recommended set.

Slots 2-5 must be recaptured after the corrected TestFlight build is processed. Do not reuse stale images that show Coach controls, baked pricing, placeholders, microphone access, or old consent behavior. Keep the original screenshot candidates until the final set is approved.

The subscription review image is separate: `assets/app-store/subscriptions/formie-monthly-review.png`. Capture the corrected native paywall with the StoreKit-localized price visible and no Coach entitlement claim.

Before any upload, run `npm run audit:submission-assets`. It fails unless all five images and the subscription review screenshot exist at 1290 x 2796 and contain no alpha channel or transparency.
