# Internal TestFlight Home Layout Release Design

## Objective

Produce an internal TestFlight build of FORM whose home screen renders correctly on the registered iPhone. The build must run independently of Metro, Developer Mode, and the development-client launcher.

## Confirmed Layout Failures

The first-recording home state differs from the returning-user state in two important ways:

- Its `ScrollView` does not request automatic content inset adjustment, allowing the header and profile control to enter the iPhone status-bar or sensor area.
- Its hero card has a fixed height of 390 points and overlays a second CTA on artwork that already contains the "Record an Exercise" CTA. On compact phone heights, this makes the hero too tall and creates two competing buttons over the center artwork.

## Home Screen Design

The first-recording state will use the same automatic safe-area behavior as the returning-user state. The loading state will also keep its header inside the safe area so every path positions the profile control consistently.

The hero pressable will preserve the current production artwork and make the entire card the interactive target. Its size will follow the source image aspect ratio, `813 / 605`, instead of a fixed 390-point height. This keeps the full camera illustration and baked-in CTA visible across compact and large iPhone screens.

The separately rendered "Record your first set" overlay will be removed. The card retains the existing accessible button role and "Record an Exercise" label, so VoiceOver users still receive a real actionable control even though the visual CTA is part of the artwork.

The returning-user home state and recent-analysis list remain visually unchanged.

## Verification

Automated home-screen tests will cover:

- the first-recording container requesting automatic inset adjustment;
- only one recording CTA being represented by the screen;
- the recording hero remaining a pressable accessible control;
- existing loading, empty-history, recent-history, and resume-analysis behavior.

The implementation will then pass TypeScript checking, the focused home tests, and Expo Doctor. The development client will be used for a physical-iPhone visual check of the header, profile button, hero artwork, CTA, and tab bar before the store build starts.

## Internal TestFlight Release

The release will use the existing bundle identifier `app.form.coach` and EAS production profile. If App Store Connect does not yet contain the application record, it will be created with:

- App Store Connect name: `FORM AI Coach`
- Primary language: English (U.S.)
- SKU: `form-ai-coach-ios-1`
- Bundle ID: `app.form.coach`

EAS will build an App Store-signed production IPA with an auto-incremented build number and upload it to App Store Connect. An internal TestFlight group will be created and the account holder added as the first tester. This initial internal distribution does not require Beta App Review.

## Error Handling

- A failed local verification blocks the store build.
- A signing or upload failure will be reported with the EAS build or submission identifier and the exact failing phase.
- Missing App Store Connect agreements, tax information, app records, or authentication will pause only the upload step; the verified production artifact will remain available.
- TestFlight processing will be monitored until the build is available to the internal group or Apple reports a specific processing error.

## Out of Scope

- External TestFlight distribution and Beta App Review
- Public App Store submission
- 3D pose, hand, or equipment tracking
- Coaching-model or analysis-pipeline changes
- Unrelated screen redesigns
