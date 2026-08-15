# Formie Build 51 App Store Release Design

## Objective

Release the already-uploaded Formie iOS Build 51 through the real App Store production review path. The release is complete only when Apple reports the App Store version as submitted/in review (or a later review state), not merely when an IPA exists or TestFlight reports internal availability.

## Confirmed starting state

- Expo project: `@yuancheng/form-ai-coach` (`d05da588-4c59-4d3c-963d-a6d2b940fea1`).
- Apple app: Formie (`6796542864`), bundle identifier `app.form.coach`.
- App Store version: `1.0`, iOS version resource `12d7e88e-fbfd-464c-b92b-c1a874b50e79`, currently `PREPARE_FOR_SUBMISSION`.
- Apple Build 51: `c82195d5-6657-4b62-96d7-ead09691864f`, `VALID`, unexpired, and using no non-exempt encryption.
- Build 51 is attached to App Store version 1.0.
- Draft review submission: `d7af71f4-fa4e-4b3e-938e-f2fd5c7946f0`, currently empty because Apple will not accept an incomplete app version as a review item.
- Subscription: Formie Monthly (`formie_monthly`, Apple resource `6798022474`), currently `READY_TO_SUBMIT` and therefore eligible to accompany the first app version.
- Existing approved TestFlight beta-review contact fields are present and can be copied to the production app-review detail without inventing personal information or exposing it in logs.

## Approved release package

The production submission will use the product's existing truthful positioning and artwork. It will not add capabilities, claims, testimonials, results guarantees, or medical claims.

### App Store text

The English (United States) listing will use:

- Name: `Formie` (already configured).
- Subtitle: `Video form coaching`.
- Promotional text: `Record a set, review the moments that matter, and get clear coaching for your next rep.`
- Description:

  `Formie turns a short exercise recording into focused, evidence-linked coaching. Record your set, choose the exercise and equipment you used, and review the moments that most affect your technique.`

  `Each analysis explains what happened, why it matters, and what to do next. Corrections are tied to specific moments in your recording so you can understand the feedback and apply it on your next set.`

  `Use Formie to:`

  `- Record or review an exercise set`

  `- See prioritized technique corrections`

  `- Revisit the exact evidence behind each correction`

  `- Track saved analyses and progress over time`

  `- Manage Formie Pro from the app`

  `Formie is an educational fitness tool and is not medical advice. Exercise within your ability and seek qualified guidance when needed.`
- Keywords: `fitness,form,coach,workout,exercise,video,technique,strength,gym,training`.
- Support URL: `https://useformie.com/support`.
- Marketing URL: `https://useformie.com`.
- Privacy policy URL: `https://useformie.com/privacy`.
- Copyright: `2026 Formie`.
- IDFA use: false.
- Third-party content declaration: Formie does not use third-party content that requires rights clearance.
- Release type: automatically release after Apple approval (`AFTER_APPROVAL`), matching the currently configured App Store version.

## Website and legal-page boundary

The existing privacy policy contains a sentence saying it is a draft that will be finalized before public release. The implementation will remove only that draft-status sentence and replace it with a present-tense summary of the policy. It will not rewrite the substantive data-handling, retention, security, billing, or user-rights statements.

The existing terms page also identifies itself as a draft. Because App Store metadata requires a privacy policy URL but does not require a terms URL for this submission, the terms page will not be linked from the App Store listing or changed as part of this scoped release unless Apple validation specifically requires it.

The privacy and support routes must return a successful public HTTPS response after deployment before the App Store metadata is submitted.

## App Store screenshots

The release will use three truthful iPhone portrait screenshots derived from existing product artwork that already represents current Formie screens:

1. A dashboard/home view showing the entry point to record a set and saved analyses.
2. A recording/setup view showing exercise preparation and capture guidance.
3. A coaching/results view showing evidence-linked corrections, the recorded set, and next-step guidance.

The selected source assets must be inspected before use. Each delivered screenshot will be exported to an Apple-supported iPhone portrait size without stretching, clipped text, QR codes, debug chrome, TestFlight UI, or claims not present in the app. Images will be visually checked after export and again after Apple upload. If an existing composite cannot satisfy those rules, a real screen capture from Build 51 will replace it; synthetic UI will not be used.

## Age rating and privacy declarations

The age-rating declaration will reflect actual product behavior:

- No violence, weapons, gambling, sexual content, profanity, alcohol, tobacco, drugs, horror, contests, or unrestricted web access.
- Fitness/wellness guidance is present.
- User-generated exercise videos are private account content rather than a public social feed.
- The app is not designed for children.

App privacy declarations will be preserved if already configured. Before submission, Apple validation must confirm that the privacy questionnaire is complete. No privacy answers will be fabricated through the API; if the account-level questionnaire is incomplete and unavailable through the supported API, the release must stop at that exact Apple requirement rather than submit inaccurate declarations.

## Production review information

Create the production `appStoreReviewDetail` by copying the existing approved TestFlight beta-review contact name, email, and phone. The production review record will keep `demoAccountRequired` false because the approved beta configuration does not require a demo account and the app supports account creation. Reviewer notes will explain the shortest deterministic flow:

1. Create or sign in to an account.
2. Complete onboarding.
3. Record or select a short exercise set.
4. Choose the exercise/equipment declaration.
5. Submit the recording and open the completed analysis.
6. Open a correction to inspect its evidence and next-step coaching.

The notes will state that video processing can take several minutes and that the monthly subscription unlocks continued analysis access. No credentials, API keys, or personal contact values will be printed in terminal output or committed.

## Subscription submission

Formie Monthly must be included in the same review submission as version 1.0 because it is the first production app version and the subscription is `READY_TO_SUBMIT`. Before inclusion, verify that its localization, price, availability, review screenshot, and subscription-group metadata are complete. Do not change the product identifier, entitlement mapping, billing period, or price unless Apple returns a specific blocking validation error.

## External operations

The implementation will perform these operations in order:

1. Update and deploy the public privacy page, then verify the privacy and support URLs over HTTPS.
2. Create or update local App Store metadata configuration while preserving unrelated repository changes.
3. Push text, URLs, copyright, content-rights, age-rating, and review-detail metadata through authenticated App Store Connect tooling/API calls.
4. Export and upload the three verified screenshots to the English iPhone screenshot set.
5. Confirm Build 51 remains the build attached to version 1.0.
6. Confirm Formie Monthly is complete and add it to the review submission alongside app version 1.0.
7. Reuse the existing empty review submission when valid; otherwise delete only that empty container and create a replacement.
8. Submit the review container to Apple.
9. Poll App Store Connect until the version reports a review state such as `WAITING_FOR_REVIEW` or `IN_REVIEW`.

## File-level scope

Expected repository changes are limited to:

- `website/app/privacy/page.tsx`: remove the draft-only disclaimer and replace it with a present-tense policy introduction without changing substantive policy statements.
- `website/app/privacy/page.test.tsx`: assert that the public privacy policy no longer describes itself as a draft and retain the existing retention-policy linkage test.
- `store.config.json` (generated or updated by EAS Metadata): store the production App Store text, URLs, copyright, categories, age rating, and release metadata in source control when supported by the installed EAS schema.
- `assets/app-store/ios/6.7/01-home.png`: first reviewed iPhone screenshot export.
- `assets/app-store/ios/6.7/02-record.png`: second reviewed iPhone screenshot export.
- `assets/app-store/ios/6.7/03-coaching.png`: third reviewed iPhone screenshot export.

No mobile application behavior, Supabase function, database migration, RevenueCat product mapping, native identifier, version number, or build number will change. Existing modifications in `jest.config.js`, `package.json`, and `package-lock.json` are unrelated user work and must not be staged, overwritten, or committed.

## Error handling

- Every App Store mutation must be preceded by a read of the exact resource and followed by a read-back verification.
- API responses may be logged only after removing secrets and personal values.
- A missing legal, privacy, pricing, banking, tax, subscription, or reviewer requirement is a real release blocker; it must be reported by its Apple validation code instead of bypassed.
- Do not upload another IPA or increment the remote build number. The target is the existing Apple Build 51.
- Do not create duplicate review submissions. Reuse the empty draft or remove it only after verifying it has no items.
- Do not claim the app is live merely because it is submitted. Submission, Apple approval, and public App Store availability are separate states.

## Verification

Local and website checks:

- Run the focused privacy-page test.
- Run the website typecheck/lint/build commands defined by `website/package.json` if the privacy edit affects the production deployment.
- Verify `https://useformie.com/privacy` and `https://useformie.com/support` return HTTP 200 after deployment and render the expected content.
- Inspect each exported screenshot's pixel dimensions and visually review all three files.

Apple checks:

- Read App Store version 1.0 and confirm `build.version == 51`, build processing state `VALID`, and `expired == false`.
- Read the English localization and confirm nonempty description, keywords, support URL, and screenshot set.
- Read `appStoreReviewDetail` and confirm required contact fields exist without printing their values.
- Read the age-rating declaration, privacy status, app availability, and price schedule.
- Read Formie Monthly and confirm it remains `READY_TO_SUBMIT` or advances into review with the app.
- List review-submission items and confirm they include both version 1.0 and Formie Monthly.
- Submit the review and verify the review submission is no longer merely `READY_FOR_REVIEW`; the App Store version must report `WAITING_FOR_REVIEW`, `IN_REVIEW`, or a later state.

## Completion boundary

This task is complete when Build 51 is in Apple's production App Review queue with the Formie Monthly subscription and all required metadata. Apple approval and public storefront availability occur later and must be reported separately. If automatic release remains configured, approval should advance the app toward public availability without a manual release request.
