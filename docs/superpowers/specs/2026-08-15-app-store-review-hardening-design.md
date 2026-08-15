# Formie App Store Review Hardening Design

**Date:** 2026-08-15

**Status:** Approved design, pending implementation plan

**Scope:** Formie iOS application, Supabase backend, public policy website, and App Store Connect metadata

## Context

Apple rejected Formie under Guideline 3.1.2 because the auto-renewable subscription submission did not include a functional Terms of Use (EULA) link. The standard Apple EULA URL has now been added to the editable App Store description, but the rejected binary also exposed broader release risks that should be addressed before submitting a replacement build.

The underlying product gaps are:

- The premium screen does not expose Terms of Use, Privacy Policy, or Restore Purchases. Restore behavior already exists in the billing provider but is unreachable from this screen.
- The premium screen artwork contains fixed plan copy while the native layer only overlays the purchase button. The displayed price and period therefore are not guaranteed to match the current StoreKit product.
- Users can create an account but cannot initiate complete account deletion in the app.
- The authentication UI displays Google and email options as disabled, with visible “Coming soon” labels, making the release look incomplete.
- The public Terms page still calls itself a draft, and the policies need a clearer description of video, body-position, AI-provider, retention, deletion, subscription, and privacy-choice behavior.
- App Store metadata needs a durable source-controlled EULA check, a privacy-choices destination, accurate review instructions, and a fresh privacy-label reconciliation.

This work is not a promise that Apple can never reject the app. Review decisions can depend on live reviewer behavior, policy interpretation, business declarations, and external service state. The goal is to remove the material, discoverable review risks in the current product and provide evidence for the replacement submission.

## Goals

1. Make the subscription offer complete, dynamic, understandable, and recoverable.
2. Allow an authenticated user to permanently delete their Formie account and user-owned data from inside the app.
3. Remove unfinished authentication controls from the production UI.
4. Publish final, internally consistent legal and privacy information.
5. Keep App Store listing metadata and review instructions synchronized with the shipped behavior.
6. Verify the full change set locally, deploy the website, and produce a fresh iOS binary for review.

## Non-goals

- Adding Google or email authentication to this release.
- Automatically cancelling an Apple subscription when an account is deleted. Apple subscription management remains an Apple-controlled action and must be explained to the user.
- Claiming a real StoreKit purchase, renewal, refund, account deletion, or Apple review outcome without executing and observing that external flow.
- Changing the developer’s trader status, age-rating answers, encryption declaration, or other business/legal declarations without verified information from the account owner.
- Replacing Apple’s standard EULA with a custom license agreement.

## Approaches Considered

### Metadata-only resubmission

This would address the cited EULA rejection quickly, but it would leave the unreachable restore flow, missing account deletion, incomplete-looking authentication options, static paywall copy, and draft Terms page. It is rejected because it treats only the observed symptom.

### Minimal UI patch

This would add links and a delete button but leave deletion as a support request or partial database operation. It is rejected because Apple requires account deletion to be initiated in the app and users reasonably expect “Delete account” to remove all user-owned content, not merely sign them out.

### Comprehensive release hardening

This design connects existing billing capabilities to the UI, builds a server-authoritative and idempotent deletion workflow, removes unfinished controls, aligns public policies with actual data flows, reconciles App Store metadata, and verifies a new binary. This approach was selected because it resolves the product causes behind the review risks.

## Architecture and Ownership Boundaries

The implementation is divided into five boundaries:

1. **Presentation:** premium, authentication, and profile screens render actions and explain consequences. They never perform privileged deletion directly.
2. **Application orchestration:** Expo routes connect UI callbacks to billing, legal-link, authentication, and account-deletion services. They own navigation and local-session cleanup.
3. **Privileged backend:** a Supabase Edge Function authenticates the caller, deletes user-owned Storage objects and privacy-linked records, then hard-deletes the Supabase Auth user.
4. **Public policy website:** final Terms, Privacy, retention, and privacy-choice pages describe the behavior implemented by the app and backend.
5. **Store submission:** source-controlled metadata checks and App Store Connect fields describe the same subscription, deletion, privacy, and review flows.

No client request may specify another user ID or arbitrary storage path. The backend derives identity exclusively from the verified access token.

## Subscription and Premium Screen Design

The premium experience will stop relying on a raster image for essential price and legal information. Brand artwork may remain decorative, but the actionable offer must be rendered as native, accessible text and controls.

The screen will display:

- Product name and included benefit copy.
- The current localized StoreKit price from the RevenueCat offering.
- The billing period, expressed as a monthly auto-renewing subscription.
- A concise auto-renewal disclosure explaining that payment is charged to the Apple ID, renewal continues until cancelled, and management/cancellation occurs in Apple subscription settings.
- A primary subscribe button disabled when the Store offering is unavailable.
- Restore Purchases.
- Clickable Terms of Use and Privacy Policy links.
- Existing purchase synchronization and retry status without hiding the legal or restore controls.

The route must pass the billing provider’s existing `restore()` action and `restoreMessage` into the screen. Both standalone subscription and onboarding premium routes must pass the same legal URLs and behavior. Restore success, no-purchase, and failure states must be visible and accessible. The screen must not imply a successful purchase until RevenueCat entitlement synchronization confirms access.

## Authentication Release Design

The production social-provider component will render only authentication methods that are enabled and functional in this release. Apple sign-in remains visible. Disabled Google and email rows, their “Coming soon” badges, and their unused labels will be removed from the rendered interface.

This is a release-readiness change, not deletion of backend capability. Existing email/Google service code may remain if used by other tested paths, but the public login and onboarding screens must not advertise unavailable actions.

## Account Deletion User Experience

The Profile screen will include a visually distinct “Delete Account” action near Log Out and the legal links. Selecting it opens an explicit confirmation flow.

The confirmation explains that deletion permanently removes the Formie account, uploaded videos, generated analysis artifacts, analyses, coaching history, profile, and app activity associated with the account. If the user has active or unresolved subscription access, it also explains that deleting a Formie account does not cancel Apple billing.

The confirmation provides:

- **Manage Apple Subscription:** opens the existing Apple/RevenueCat subscription-management destination.
- **Delete Account Now:** remains available so subscription management does not block immediate account deletion.
- **Cancel:** exits without changes.

The destructive confirmation requires an intentional final action, such as entering `DELETE`, but does not require contacting support or waiting for a manual process. While deletion runs, duplicate submissions are disabled. A failure leaves the signed-in session available so the user can retry and displays a precise, non-success message.

On server-confirmed success, the client:

1. clears or invalidates cached application data;
2. logs out or resets the RevenueCat customer association;
3. clears the Supabase local authentication session even if the server-side Auth user is already gone;
4. clears local onboarding/capture state that is scoped to the deleted account;
5. returns to the signed-out entry route; and
6. explains how a Sign in with Apple user can also remove Formie from Apple ID authorization settings.

Apple authorization revocation guidance must not block Formie deletion. The current Supabase OAuth client does not expose an Apple refresh/access token suitable for the token-revocation endpoint, so the server cannot truthfully claim it revoked Apple authorization. If the auth architecture later stores Apple authorization tokens securely, server-side token revocation can replace this guidance.

## Account Deletion Backend Workflow

A new authenticated `delete-account` Edge Function owns deletion. The request body contains only confirmation/version information; it does not accept a target user ID.

The handler executes the following idempotent sequence:

1. Validate the bearer token and derive the current user ID with the shared authentication helper.
2. Use the service-role client only after authentication succeeds.
3. Enumerate all objects owned by the user in `analysis-videos` and `analysis-artifacts` using the server-derived user-prefix convention. Pagination must continue until every object is identified.
4. Reject unexpected paths and remove only objects whose normalized first path segment exactly equals the authenticated user ID.
5. Treat already-absent objects and rows as successful idempotent progress; surface permission, enumeration, or removal failures.
6. Explicitly delete `product_analytics_events` rows linked to the user so analytics properties are not retained merely because the current foreign key sets `user_id` to null.
7. Hard-delete the Supabase Auth user with the admin API. Existing `ON DELETE CASCADE` relationships then remove user profile, sessions and dependent analysis records, coaching data, memberships, entitlements, credit reservations, feedback, onboarding attribution, and other directly owned relational records.
8. Return success only after Storage cleanup, explicit privacy-row cleanup, and Auth deletion have all completed.

The function must be safe to retry after a partial failure. Storage and explicit row deletion happen before Auth deletion because storage ownership does not cascade from `auth.users`, and Supabase Auth deletion can be blocked by owned Storage objects. If Auth deletion succeeds but the HTTP response is lost, a later client retry may no longer authenticate; the client must therefore treat an invalidated session plus a missing user as a signed-out state, without displaying an unverified “all data deleted” claim.

The function logs stage names and non-sensitive error codes only. It must not log access tokens, video paths beyond the user-independent bucket/stage context, email addresses, Apple identifiers, or deleted content.

Any transaction or event retained by Apple or RevenueCat is outside this Supabase deletion boundary. The policy must distinguish Formie-controlled deletion from records retained by payment processors for legal, fraud, accounting, or platform obligations.

## Data-Relationship Hardening

Implementation must inventory every current foreign key to `auth.users` before relying on cascade behavior. A migration will change privacy-linked analytics ownership from `ON DELETE SET NULL` to `ON DELETE CASCADE` if this can be done without breaking founder reporting. The function will still explicitly delete current analytics rows before Auth deletion so deletion is correct both before and after migration deployment.

The migration and tests must ensure:

- user-owned application tables cascade on Auth deletion;
- no user-linked table silently retains identifying properties after its user ID becomes null;
- shared catalog/configuration data is never deleted;
- storage cleanup remains an explicit function responsibility; and
- payment-platform records outside Formie’s database are not represented as deleted by this workflow.

## Public Terms, Privacy, and Privacy Choices

The public Terms page will remove all draft or pre-release language and state the production subscription terms consistently with the native paywall and Apple standard EULA.

The Privacy page will clearly identify:

- account identifiers and profile data;
- purchase/entitlement information;
- uploaded photos/videos and other user content;
- body, head, hand, motion, fitness, and derived form-analysis data;
- product interaction, diagnostic, support, and analytics data;
- the purposes for collection and processing;
- AI/cloud, hosting, analytics, authentication, and payment-provider categories;
- whether data is linked to an identity and whether it is used for tracking;
- retention rules and user controls;
- in-app account deletion and individual-analysis deletion;
- limits covering Apple/RevenueCat records and Apple authorization; and
- how to contact Formie regarding privacy requests.

A dedicated `/privacy-choices` page will provide a stable App Store Connect “User Privacy Choices URL.” It will describe the in-app account-deletion path, analysis deletion, subscription management, Sign in with Apple authorization management, and the support route. It supplements, but never substitutes for, in-app account deletion.

The site shell/footer will expose the privacy choices page so it is discoverable outside App Store metadata.

## App Store Connect and Submission Design

The repository metadata will retain the functional standard Apple EULA URL:

`https://www.apple.com/legal/internet-services/itunes/dev/stdeula/`

The metadata validation test will also require production HTTPS Terms, Privacy, Support, and Privacy Choices URLs and reject draft/pre-release markers in listing text.

Before submission, App Store Connect must be reconciled manually against the shipped binary:

- Description contains the EULA URL.
- Privacy Policy URL points to the final production Privacy page.
- User Privacy Choices URL points to `/privacy-choices` after deployment.
- App Privacy data types and purpose/linkage answers match actual app, Supabase, RevenueCat, AI-provider, and diagnostic behavior.
- Review notes state that Apple sign-in is the only visible account method, give exact subscription/restore/account-deletion navigation, explain camera/video requirements, and identify any behavior that requires a physical device.
- Review contact fields are complete and current; no values will be invented by implementation.
- A new build produced from the verified source commit is selected.

The prior Developer Rejected build must not be resubmitted after native behavior changes. Submission happens only after the website and backend used by that build are deployed and verified.

## Error Handling and Recovery

- Store offering unavailable: disable purchase, keep legal and restore controls usable, and show a recoverable status.
- Restore failure: retain the screen, show the provider-safe error, and allow retry.
- External-link failure: show an error without crashing or blocking other subscription actions.
- Account-deletion authentication failure: return 401 and do not initialize privileged deletion.
- Storage listing/removal failure: return a stage-specific non-success and do not claim completion.
- Database cleanup failure: return non-success before Auth deletion where possible.
- Auth deletion failure: retain the session if it remains valid and allow retry.
- Client cleanup failure after server success: force navigation to signed-out state, avoid recreating the deleted identity, and report only the local cleanup problem.
- Backend timeouts: operations remain idempotent; the client may retry after revalidating session state.

## Security and Privacy Requirements

- The server derives identity from the bearer token and never trusts client-supplied user IDs.
- The service-role key remains server-only.
- Storage paths are normalized and exact-prefix checked before removal.
- Deletion responses and logs contain no secrets or deleted personal content.
- Error messages shown to users are actionable without exposing backend internals.
- The destructive action is protected from accidental taps and duplicate requests.
- Legal copy describes actual deployed behavior; it must not make absolute promises that conflict with required processor retention.

## Testing and Verification Strategy

Implementation follows test-driven development, with failures observed before production changes.

### Mobile unit and component tests

- Premium screen renders localized price, monthly period, auto-renewal disclosure, Restore Purchases, Terms, and Privacy.
- Onboarding and standalone routes pass restore and legal callbacks.
- Restore success, no entitlement, and failure copy is visible.
- Auth screens render Apple but no disabled Google/email “Coming soon” controls.
- Profile renders Delete Account and the complete confirmation flow.
- Active subscription warning provides management and immediate deletion actions.
- Delete confirmation prevents accidental or duplicate submission.
- Server success clears billing/auth/local state and navigates signed out.
- Server failure preserves the session and permits retry.

### Edge Function tests

- Rejects missing/invalid authentication.
- Ignores or rejects any client-supplied target identity.
- Paginates both storage buckets and deletes only exact user-owned paths.
- Stops and returns non-success on storage failures.
- Explicitly deletes privacy-linked analytics.
- Calls hard Auth deletion only after earlier stages succeed.
- Treats already-missing objects/rows as idempotent success.
- Redacts sensitive information from errors/logging.

### Database tests

- Verify the complete `auth.users` foreign-key inventory.
- Verify expected cascade behavior and analytics cleanup.
- Verify unrelated users and shared data survive deletion.

### Website tests

- Terms contain no draft/pre-release language and include production subscription disclosures.
- Privacy covers declared data categories, processors, retention, and deletion.
- Privacy Choices exposes the in-app deletion, analysis deletion, Apple subscription, Apple authorization, and support paths.
- All legal pages use production canonical links and remain responsive.

### Release verification

- Run focused Jest tests during implementation.
- Run all Jest tests, TypeScript checking, linting, and Expo export before declaring the mobile source ready.
- Run website tests, type checking, linting, and production build.
- Run Edge Function/Deno tests and migration validation.
- Deploy backend changes and verify the function is reachable with both unauthenticated rejection and a controlled authenticated test account.
- Deploy the website and verify the live Terms, Privacy, Retention, Support, and Privacy Choices URLs.
- Produce a fresh EAS production iOS build from a clean, identified commit and verify build-to-commit correspondence.
- Test sign-in, paywall, restore, subscription management, and account deletion on a physical iOS build where credentials and safe test data are available.
- Reconcile App Store fields, select the new build, and submit only after all applicable evidence is collected.

Passing source tests does not prove Apple sandbox purchasing, RevenueCat webhook delivery, physical-device camera behavior, production deletion, deployment, or App Store acceptance. Those boundaries must be reported separately.

## Detailed File Impact

The implementation plan must confirm exact line-level changes after current tests and interfaces are read. Expected files and responsibilities are:

| File | Required change | Technical method |
| --- | --- | --- |
| `src/screens/onboarding/premium-screen.tsx` | Replace essential static offer copy with native dynamic content; add restore, legal links, renewal disclosure, and restore state. | Extend props for restore/legal callbacks and message; render accessible `Pressable` controls; preserve decorative artwork only where it does not encode the authoritative price/terms. |
| `src/screens/onboarding/approved-onboarding.tsx` | Bridge restore and legal behavior into the premium step. | Extend the approved-screen props and pass existing Terms/Privacy callbacks plus the new restore callback/message to `PremiumScreen`. |
| `src/screens/onboarding/approved-onboarding.test.tsx` | Replace assertions that restore is absent; cover links, disclosure, callbacks, and errors. | Add interaction tests that press each control and assert the route callback exactly once. |
| `src/app/onboarding/[step].tsx` | Connect billing restore and legal config to onboarding premium. | Pass `billing.restore`, `billing.restoreMessage`, and `getLegalLinks()` results through the approved onboarding component. |
| `src/app/subscription.tsx` | Give the standalone premium route feature parity. | Resolve legal links, pass restore/message, and use the existing URL opener/error path. |
| `src/features/auth/onboarding-auth-route.test.tsx` | Verify premium legal/restore route wiring. | Update mocks and assertions for the expanded component contract. |
| `src/features/billing/manage-subscription-route.test.tsx` | Protect subscription management and deletion-warning integration. | Extend existing billing-route mocks for restore and management without changing entitlement semantics. |
| `src/components/social-provider-buttons.tsx` | Remove visible unavailable Google/email controls from production auth. | Render only enabled provider buttons; simplify obsolete unavailable-provider props/imports while retaining reusable service code elsewhere. |
| `src/screens/auth/auth-screens.test.tsx` | Assert only functional provider UI is visible. | Replace “Coming soon” expectations with absence checks and keep Apple interaction coverage. |
| `src/screens/profile/index.tsx` | Add deletion entry, confirmation UI, subscription warning, progress, and errors. | Add typed props/state for request, subscription management, and result; require intentional confirmation and keep the action accessible. |
| `src/screens/profile/profile.test.tsx` | Cover account-deletion UX and safety behavior. | Test cancel, confirmation, active-subscription warning, manage action, immediate deletion, busy lock, success, and failure. |
| `src/app/(tabs)/(profile)/index.tsx` | Orchestrate deletion and post-success local cleanup. | Call the account-deletion client with the current session, invoke billing/auth cleanup, clear account-scoped state/cache, and replace navigation with the signed-out route. |
| `src/features/account-deletion/api.ts` | Provide a narrow typed client for the Edge Function. | Invoke `delete-account` with the authenticated Supabase client, normalize status/error codes, and avoid accepting a user ID. |
| `src/features/account-deletion/api.test.ts` | Verify client request and error normalization. | Mock function invocation for success, unauthorized, partial failure, and network ambiguity. |
| `src/features/auth/auth-provider.tsx` | Support reliable local session invalidation after server-side deletion if current logout assumes a live remote user. | Add or expose a local-clear path only if existing `logOut()` cannot safely handle a deleted server identity; keep ordinary logout behavior unchanged. |
| `src/features/auth/auth-provider.test.tsx` | Protect deleted-user local cleanup. | Add coverage only if the provider contract changes. |
| `src/features/billing/billing-provider.tsx` | Reset RevenueCat association after deletion and expose existing restore state consistently. | Reuse `logOut()`/`restore()` where sufficient; change the provider only if route orchestration reveals a missing typed state. |
| `supabase/functions/delete-account/handler.ts` | Implement server-authoritative, staged, idempotent deletion. | Authenticate; enumerate/remove exact user storage; delete privacy rows; hard-delete Auth user; return safe structured stage errors. |
| `supabase/functions/delete-account/handler.test.ts` | Prove identity, ordering, isolation, pagination, idempotency, and failures. | Inject mocked auth/admin/storage dependencies and assert no Auth deletion occurs after an earlier failed stage. |
| `supabase/functions/delete-account/index.ts` | Expose the Edge Function HTTP entry point. | Apply shared CORS/method handling and delegate to the tested handler. |
| `supabase/config.toml` | Register function authentication behavior consistently with other authenticated functions. | Add the function stanza with JWT verification matching the repository’s deployment convention. |
| `supabase/migrations/202608150001_account_deletion_privacy.sql` | Make analytics deletion behavior durable and document/verify cascade expectations. | Replace the analytics user foreign key with `ON DELETE CASCADE` if schema inspection confirms compatibility; do not alter unrelated shared data. |
| `supabase/tests/account-deletion.sql` or the repository’s existing database-test location | Verify relational deletion semantics. | Create isolated users/rows, delete one user, and assert owned data removal plus unrelated-data survival. Use the actual established database-test convention discovered during planning. |
| `website/app/terms/page.tsx` | Remove draft language and publish final subscription terms. | Align plan, auto-renewal, cancellation, standard EULA, and account behavior with the shipped app. |
| `website/app/terms/page.test.tsx` | Prevent draft copy and missing subscription disclosures. | Add semantic text/link assertions rather than brittle full-page snapshots. |
| `website/app/privacy/page.tsx` | Fully disclose current data processing and deletion controls. | Organize content by data, purpose, processors, retention, choices, and contact; preserve truthful limitations. |
| `website/app/privacy/page.test.tsx` | Protect required policy subjects. | Extend current tests for video/body-derived data, AI providers, linkage, retention, deletion, and processor limits. |
| `website/app/privacy-choices/page.tsx` | Add stable user privacy controls destination. | Use the existing site layout and link to in-app instructions, retention, subscription/Apple authorization guidance, and support. |
| `website/app/privacy-choices/page.test.tsx` | Verify all privacy-choice paths are present. | Test labels and production destinations. |
| `website/components/site-shell.tsx` | Make Privacy Choices discoverable. | Add a footer/legal-navigation link without changing unrelated marketing layout. |
| `store.config.json` | Keep listing URLs and description aligned with production. | Retain the Apple standard EULA and add/align Terms, Privacy, Support, and Privacy Choices metadata supported by the store tooling. |
| `scripts/store-metadata.test.cjs` | Fail release verification on missing legal metadata or draft language. | Parse store config and assert exact HTTPS destinations and prohibited markers. |
| `docs/superpowers/specs/2026-08-15-app-store-review-hardening-design.md` | Record the approved architecture and boundaries. | This document. |
| `docs/superpowers/plans/2026-08-15-app-store-review-hardening.md` | Provide the executable file-by-file implementation plan. | Create only after this design is reviewed; include failing tests, exact edits, commands, deployment gates, and evidence boundaries. |
| App Store Connect listing, privacy, review information, and build selection | Align live external state with the verified release. | Perform a fresh read before edits, update only verified fields, never invent contact/business declarations, and capture final status evidence. |

If planning discovers an existing repository abstraction that owns one of these responsibilities, the implementation plan may consolidate files, but it must explain the substitution and preserve every behavior and test boundary above.

## Rollout Order

1. Write failing mobile tests for premium/auth/profile behavior.
2. Implement premium and auth UI wiring.
3. Write failing account-deletion client and Edge Function tests.
4. Implement backend deletion, migration, and client orchestration.
5. Complete focused and full mobile/backend verification.
6. Write failing website policy tests and implement final pages.
7. Complete website verification and deploy it.
8. Deploy and safely exercise backend deletion with controlled test data.
9. Build and physically verify the new iOS candidate.
10. Reconcile App Store privacy/metadata/review notes, attach the new build, and submit.

Each external deployment or submission remains a distinct evidence gate. No later step is reported complete merely because its source code exists.
