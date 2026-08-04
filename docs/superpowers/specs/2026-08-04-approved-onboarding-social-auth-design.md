# Formie Approved Onboarding and Social Authentication Design

Date: 2026-08-04
Status: Approved in conversation; awaiting written-spec review

## Objective

Replace the unfinished five-screen `certainty-v1` onboarding and all email/password authentication surfaces with the approved 17-screen Formie onboarding sequence and Google/Apple authentication.

The implementation must solve the launch-routing problem at its source. A fresh signed-out installation must enter onboarding, an explicit logout must enter Login, and the mere existence of an OAuth session must not let a newly created identity bypass onboarding or the account-creation step.

## Visual Source of Truth

The authoritative references are the 17 PNG files and sequence in:

`C:\Users\yuanc\Downloads\Formie_Onboarding_Approved.zip`

The app recreates the UI shown inside the pictured iPhone. It must not render the mock iPhone frame, outer background, duplicated Dynamic Island, or pictured home indicator.

The primary comparison viewport is 390 by 844 points. The same composition must remain usable on smaller and larger supported phones by respecting safe areas, scaling bounded artwork, allowing content to scroll when necessary, and keeping the primary action reachable above the bottom inset and keyboard.

## Approved Sequence

1. Welcome
2. Age
3. Product value
4. Gender
5. Height
6. Why Formie
7. Weight
8. Experience
9. Product demonstration
10. Primary goal
11. Biggest frustration
12. Training frequency
13. Custom milestone
14. Long-term value
15. Loading
16. Create account
17. Premium

The removed exercise selector, trust/video-check, education/habits, duplicate value, and redundant AI screens must not remain reachable through the new flow.

## UX Construction

### Shared onboarding shell

Screens 2 through 14 use one shared shell that owns:

- Safe-area-aware top spacing.
- Back navigation.
- Centered Formie mark.
- Progress track and gold progress fill derived from the approved step index.
- Black textured visual treatment, white primary text, muted gray supporting text, and gold emphasis.
- A bottom gold `Continue` button with the approved arrow treatment.
- Keyboard avoidance and scroll fallback where content cannot fit.

Welcome, Loading, Create Account, and Premium use purpose-specific layouts but reuse the same theme tokens, logo asset, spacing scale, and accessibility rules.

### Real controls

The approved reference values are examples, not hard-coded answers:

- Age is an interactive bounded wheel, defaulting to 18 only when there is no saved answer.
- Gender uses the three approved single-select cards.
- Height uses the approved imperial/metric segmented control and synchronized wheel values. The canonical stored value is centimeters.
- Weight uses the approved pound/kilogram segmented control and synchronized wheel. The canonical stored value is kilograms.
- Experience uses Beginner, Intermediate, and Advanced cards with the approved descriptions.
- Primary goal uses Build muscle, Get stronger, Lose weight, and Improve technique.
- Biggest frustration uses Plateau, Unsure about form, Discomfort, and Lack confidence.
- Training frequency is an accessible integer slider from one to seven workouts per week.
- Custom milestone is a 60-character text field with a clear action, live counter, approved example copy, and keyboard-safe Continue action.

Continue is disabled only when the current required answer is absent or invalid. Back preserves all answers. Closing and reopening the app resumes at the last visited step.

### Marketing and transition screens

Product value, Why Formie, Product demonstration, and Long-term value recreate the approved hierarchy and artwork using native cards, type, lines, and existing Formie product imagery. The app does not ship a screenshot of a phone as the screen UI.

Loading displays the approved centered logo, animated gold progress ring, and `Building your profile...` copy for a bounded transition. It advances after the local draft has been validated and persisted. It never pretends that an account or server profile exists before OAuth succeeds.

### Create account

Create Account matches approved Screen 16 and contains:

- `Continue with Apple`.
- `Continue with Google`.
- Privacy reassurance.
- Working Terms and Privacy Policy links.
- `Restore account`, which opens the separate Login screen.

There are no email, password, confirmation-code, forgot-password, or verification controls.

### Login after logout

Login is a separate OAuth-only screen in the same visual system. It is shown after explicit logout and when `Restore account` is selected. It contains:

- `Continue with Apple`.
- `Continue with Google`.
- `Create account`, which clears any abandoned draft and starts Welcome.
- Terms and Privacy Policy links.

It does not appear as the initial surface for a fresh signed-out installation.

### Premium

Premium matches approved Screen 17 and uses the live RevenueCat package price instead of a hard-coded value. `Go Now` purchases the selected package. An existing entitlement or successful restore completes the entry flow. Cancellation leaves the user on Premium with their authenticated account and onboarding profile intact.

Production has no visible skip control. Store unavailability, purchase failure, and restoration remain recoverable without replacing the approved primary composition.

## Entry State Machine

The navigation decision is derived from authenticated identity, the server profile when one exists, the versioned local onboarding draft, and an explicit local logout marker.

| State | Meaning | Required destination |
|---|---|---|
| `initializing` | Session, draft, and launch intent are loading | Branded loading surface |
| `fresh_install` | Signed out, no completed draft, no explicit logout | Welcome |
| `collecting_profile` | Signed out or newly authenticated but approved onboarding is incomplete | Saved onboarding step |
| `account_required` | Steps 1-15 are complete and no account is authenticated | Create Account |
| `profile_sync_required` | OAuth succeeded but the completed draft has not reached `user_profiles` | Blocking sync/retry state |
| `premium_required` | Account/profile are complete but access entitlement is absent | Premium |
| `ready` | Authenticated, server onboarding complete, and access rules permit entry | Main app |
| `logged_out` | Explicit logout marker exists and there is no session | Login |

### Launch rules

- A valid restored session for an existing completed account enters the app without replaying acquisition onboarding.
- A fresh signed-out installation enters Welcome even if the person may already own an account. They can use `Restore account` on Screen 16.
- Explicit logout persists the logout marker before the local Supabase session is cleared. Once signed out, Login wins over the default fresh-install rule.
- `Create account` on Login clears the logout marker and onboarding draft, then routes to Welcome.
- OAuth initiated from Create Account records `create_account` intent.
- OAuth initiated from Login records `login` intent.
- An OAuth identity selected from Login that has no completed server profile is a new/incomplete account. It is routed to Welcome instead of being admitted to the app.
- An OAuth identity selected from Create Account receives the completed local draft, then continues to Premium.
- A local draft is migrated to the authenticated user scope only after the OAuth user ID is known.
- Signing into a different completed account never receives another account's scoped draft or cached private queries.

This state machine replaces route decisions based only on `auth.phase` or a fragile collection of booleans.

## Local Onboarding Draft

The new storage key is versioned separately from `formie.onboarding.v1`. Its payload contains:

- Schema version and onboarding version.
- Current approved step.
- Age in years.
- Gender choice.
- Canonical height in centimeters and selected display system.
- Canonical weight in kilograms and selected display system.
- Experience.
- Primary goal.
- Biggest frustration.
- Workouts per week.
- Custom milestone.
- Flow status: collecting, account required, profile sync required, premium required, or complete.
- OAuth intent when one is active.
- Owner user ID after authentication.
- Explicit logout timestamp in the device-level entry record.

Native storage uses Expo SecureStore with `WHEN_UNLOCKED_THIS_DEVICE_ONLY`. Web development uses the existing local-storage fallback. Parsing is schema-validated; an invalid or obsolete partial payload falls back safely without unlocking the app.

The old `certainty-v1` state may be discarded because it describes a different approved sequence and has no compatible answers. An explicit logout marker is preserved during migration so an upgrade does not unexpectedly replay onboarding immediately after logout.

## Server Profile Model

`public.user_profiles` remains the authoritative account profile protected by existing owner-only RLS. A forward migration adds:

- `age_years` with a reasonable adult range check.
- `gender` constrained to `male`, `female`, or `prefer_not_to_say`.
- `height_cm` with a plausible positive range check.
- `weight_kg` with a plausible positive range check.
- `measurement_system` constrained to `imperial` or `metric`.
- Existing `experience`, retaining its current values.
- `primary_goal`, expanded to include `lose_weight` while preserving legacy values.
- `biggest_frustration` with the four approved values.
- `workouts_per_week` constrained to one through seven.
- `custom_milestone` limited to 60 characters.
- `onboarding_version`.
- The existing completion fields, updated atomically with the approved answers.

Profile creation must stop marking every missing row complete. The completed onboarding draft is upserted as one authenticated owner-scoped operation. If it fails, the app remains in `profile_sync_required` with a retry action and does not show Home.

Existing production accounts must not be mistaken for new OAuth users. The migration preserves completed legacy rows. Existing authenticated users with established app data but no row are handled by an explicit legacy compatibility path rather than by universally treating all new missing profiles as complete.

## Google and Apple Authentication

Both providers use Supabase OAuth with PKCE, `expo-web-browser`, and the existing `form://auth/callback` deep link. The browser session returns only to the registered callback. The app exchanges the authorization code through Supabase and never logs authorization codes, access tokens, refresh tokens, provider tokens, or Apple secrets.

The authentication service exposes a provider-based operation with explicit intent instead of separate email/password methods. Only `apple` and `google` are accepted.

### Google Cloud configuration

- Configure the OAuth consent screen and production application branding.
- Create the required Google OAuth client for the Supabase callback origin.
- Register the exact Supabase Auth callback URI.
- Enable Google in the live Supabase Auth provider settings.
- Store client secrets only in Google/Supabase provider configuration, never in Expo public variables or the repository.

### Apple configuration

- Enable Sign in with Apple for the production App ID.
- Configure the Service ID and its website/return URL for the Supabase callback.
- Create the Sign in with Apple key and configure the provider in Supabase.
- Keep the Apple private key and generated secret out of the repository and client bundle.
- Retain the production iOS bundle identifier `app.form.coach`.

### Callback behavior

The auth callback handler accepts only the configured app callback, completes the PKCE exchange, restores the saved OAuth intent, clears provider browser state, and lets the central entry resolver choose the next surface. It does not redirect directly to Home.

Provider cancellation, denial, network failure, invalid callback, and expired PKCE state return a stable user-facing error on the initiating Login or Create Account screen. The local onboarding draft remains intact.

## Removal of Password Authentication

The following product behaviors are removed:

- Email/password login and signup.
- Email verification and resend-code flows.
- Forgot/reset password flows.
- Change email and change password routes and Profile actions.
- Pending email-verification persistence.
- Password validation and password-specific error copy.

Removing the UI is not sufficient. The root navigator, auth provider/service types, callback decisions, tests, and Profile navigation must no longer depend on these states or methods.

Password-provider disablement in live Supabase is performed only after Google and Apple sign-in have been verified with real disposable identities so existing users are not accidentally locked out during deployment.

## Privacy and Analytics

Raw age, gender, height, weight, frustration, and custom milestone must not be added to product analytics. Screen-view and CTA events may contain only approved non-sensitive fields such as screen ID, numeric step, provider name, intent, onboarding version, and stable error category.

The account and profile rows remain protected by authenticated owner-only RLS. No provider or backend secret is stored in source control, `.env.example`, Expo public configuration, analytics, or logs.

## Error Handling

- Local persistence failure keeps the current screen usable and reports that progress could not be saved.
- Invalid draft data is rejected before profile sync.
- OAuth cancellation is neutral and retryable.
- OAuth provider or callback failure retains the draft and initiating intent.
- Profile sync failure blocks Home and provides retry.
- Purchase cancellation retains the account/profile and stays on Premium.
- Purchase or offering failure provides retry and restore without a production skip path.
- Logout clears RevenueCat identity, private query cache, Supabase local session, and user-scoped in-memory state while preserving the explicit logout marker.
- A partially failed logout is safe: authenticated state still gates the app; once the session is absent, the persisted marker routes to Login.

## Accessibility and Responsiveness

- All actions have correct button/link roles and explicit labels.
- Choice cards expose selected state.
- Wheels and sliders expose adjustable semantics and readable current values.
- Minimum touch targets are 44 by 44 points.
- Text scales without hiding the primary action; overflow screens can scroll.
- Reduced-motion users receive static progress and transition treatments.
- Keyboard appearance never covers the milestone field, counter, or Continue action.
- Gold/gray text and borders retain readable contrast on the black background.

## Implementation Surface

The implementation plan must give exact edits for every file below and may refine names only if repository inspection reveals a direct conflict.

### Navigation and entry

- `src/app/_layout.tsx`: protect routes using the combined entry state rather than `auth.phase` alone; remove password-route registrations; expose onboarding, OAuth login/callback, Premium, and the completed app in the correct states.
- `src/app/index.tsx`: resolve launch destinations from the new entry state without flashing Home.
- `src/features/auth/launch-route.ts`: replace the five-state `certainty-v1` resolver with the approved entry-state resolver.
- `src/features/auth/launch-route.test.ts`: cover fresh install, resume, account required, login after logout, incomplete OAuth user, completed existing account, Premium, and ready states.
- `src/features/auth/auth-routing.test.ts`: replace old five-route/password assertions with the approved dynamic onboarding and OAuth-only route contract.

### Onboarding routes, state, and UI

- `src/app/(onboarding)/_layout.tsx`: retain a headerless stack and register the new flow route.
- `src/app/(onboarding)/[step].tsx`: new dynamic approved-step route that delegates validation and navigation to the onboarding controller.
- Delete the obsolete `stop-guessing.tsx`, `one-clear-priority.tsx`, `product-showcase.tsx`, `record-analyze-adjust.tsx`, and onboarding `paywall.tsx` routes after the new route is green.
- `src/features/onboarding/types.ts`: replace `certainty-v1` booleans with the typed v2 draft, answers, steps, status, and reducer actions.
- `src/features/onboarding/onboarding-store.tsx`: hydrate, validate, persist, reset, resume, attach ownership, mark explicit logout, and expose answer/step actions.
- `src/features/onboarding/onboarding-store.test.ts`: test every reducer transition, persistence migration, answer normalization, resume, reset, ownership, and failure-safe behavior.
- `src/features/onboarding/onboarding-account-scope.test.ts`: prove drafts do not cross accounts and the logout marker selects Login.
- `src/features/onboarding/onboarding-schema.ts`: new runtime schema and canonical unit conversion/validation boundary.
- `src/features/onboarding/onboarding-schema.test.ts`: test valid drafts, corrupt storage, boundary values, unit conversion, and 60-character milestone enforcement.
- `src/features/onboarding/entry-state.ts`: new pure combined state resolver used by navigation.
- `src/features/onboarding/entry-state.test.ts`: test all state-table rows and no-bypass cases.
- `src/screens/onboarding/onboarding-shell.tsx`: shared frame-free header, progress, scrolling, CTA, and safe-area behavior.
- `src/screens/onboarding/onboarding-controls.tsx`: reusable option card, segmented control, adjustable wheel, frequency slider, and bottom CTA.
- `src/screens/onboarding/profile-question-screens.tsx`: Age, Gender, Height, Weight, Experience, Primary Goal, Biggest Frustration, Training Frequency, and Custom Milestone.
- `src/screens/onboarding/marketing-screens.tsx`: Welcome, Product Value, Why Formie, Product Demonstration, and Long-term Value.
- `src/screens/onboarding/loading-screen.tsx`: validated bounded transition into account creation.
- `src/screens/onboarding/account-screen.tsx`: approved OAuth account creation and Restore Account action.
- `src/screens/onboarding/premium-screen.tsx`: approved RevenueCat offer without a production skip.
- `src/screens/onboarding/index.ts`: export the new screen modules.
- `src/screens/onboarding/onboarding.test.tsx`: replace screenshot/hitbox tests with all approved screen copy, real interactions, accessibility state, back/continue behavior, and responsive layout contracts.
- `src/theme/onboarding.ts`: define exact approved colors, type sizes, spacing, progress, cards, and responsive constants without including phone-frame dimensions.
- Approved artwork assets under `assets/production/onboarding/`: retain only assets actually used by native compositions; remove references to the obsolete five-screen artwork after migration.

### OAuth authentication

- `src/app/(auth)/login.tsx`: connect OAuth-only Login, Create Account, and legal links.
- `src/app/(auth)/auth/callback.tsx`: remain a neutral callback/loading route; central state decides the destination.
- Delete `src/app/(auth)/sign-up.tsx`, `verify-email.tsx`, `forgot-password.tsx`, and `reset-password.tsx` after their registrations and imports are removed.
- `src/screens/auth/index.tsx`: replace email/password forms with the OAuth-only Login surface and stable provider errors.
- `src/screens/auth/auth-screens.test.tsx`: test provider actions, loading/cancellation/error states, Create Account, and legal links; remove password assertions.
- `src/features/auth/auth-service.ts`: replace password/signup/recovery methods with allowlisted provider PKCE initiation, browser-session completion input, logout, and session refresh.
- `src/features/auth/auth-service.test.ts`: prove provider allowlisting, redirect configuration, cancellation, errors, and no direct Home navigation.
- `src/features/auth/auth-provider.tsx`: expose Apple/Google operations with intent, restore session/callback safely, clear private state on logout, and remove pending-verification/password APIs.
- `src/features/auth/auth-provider.test.tsx`: test cold/warm OAuth callback, intent restoration, new/incomplete identity routing, existing identity routing, cancellation, and logout.
- `src/features/auth/auth-state.ts` and `auth-state.test.ts`: simplify authentication phase derivation to initializing, signed out, and authenticated; onboarding completion is resolved separately.
- `src/features/auth/auth-callback.ts` and `auth-callback.test.ts`: retain strict callback parsing for PKCE and stable OAuth errors; remove email verification/recovery flow assumptions.
- `src/features/auth/auth-session.ts` and `auth-session.test.ts`: retain permanent-session validation without requiring password/email-verification workflow states.
- Remove `pending-verification.ts` and its tests after all imports are gone.
- Remove password-only validation code/tests if no remaining account screen consumes it.
- `src/lib/supabase.ts`: configure the supported PKCE/session behavior while retaining SecureStore and `detectSessionInUrl: false` for native callback handling.
- `app.json`: retain the `form` scheme and add only the iOS Sign in with Apple capability/configuration required by the chosen production OAuth setup.
- `supabase/config.toml`: keep the exact callback allowlist and document local provider configuration without secrets.
- `.env.example`: document only non-secret public identifiers if the chosen provider path requires them; never add provider secrets.

### Profile persistence and security

- Add a new timestamped migration after `202608040002_subscription_access_and_analysis_quota.sql` that extends `user_profiles`, updates constraints, preserves legacy completed accounts, and keeps existing owner RLS intact.
- `supabase/tests/rls.sql`: assert new columns/constraints and continue proving owner-only select/insert/update.
- `src/features/profile/types.ts`: add approved onboarding profile fields and enums.
- `src/features/profile/profile-repository.ts`: map the expanded row, atomically upsert the completed onboarding profile, and stop automatically completing every missing row.
- `src/features/profile/profile-repository.test.ts`: test complete draft upsert, legacy account compatibility, canonical values, invalid writes, and incomplete-profile detection.
- `src/features/profile/profile-provider.tsx`: expose completion/sync status so navigation remains blocked until authoritative profile persistence succeeds.
- `src/features/profile/profile-provider.test.tsx`: test sync success, retry, and app-lock behavior.

### Profile and removed account management

- `src/app/(tabs)/(profile)/index.tsx`: remove change-email/password navigation and preserve the explicit-logout ordering across billing, onboarding marker, and Supabase session.
- `src/screens/profile/index.tsx`: remove Change Email and Change Password actions; retain provider account identity, profile preferences, legal links, feedback, and Logout.
- `src/screens/profile/profile.test.tsx`: replace password/email action assertions with social-account and logout behavior.
- `src/app/_layout.tsx`: remove `account/change-email` and `account/change-password` registrations.
- Delete `src/app/account/change-email.tsx` and `change-password.tsx` after references are removed; retain `send-feedback.tsx`.
- Remove password/change-email screen modules and tests under `src/screens/account` only where they have no remaining consumer.

### Premium and analytics

- `src/app/subscription.tsx`: make purchase/restore completion update the entry state and replace `router.back()` with an explicit safe destination.
- `src/features/billing/*`: preserve the in-progress RevenueCat implementation; change only entry-completion seams required by the approved flow.
- `src/features/analytics/product-analytics.ts`, utility, and tests: allow provider/intent/error categories but explicitly exclude raw onboarding answers.
- `docs/FORMIE_ONBOARDING_REVENUECAT_SETUP.md`: update the sequence and remove references to the obsolete five-screen flow or visible skip behavior.
- Add `docs/FORMIE_SOCIAL_AUTH_SETUP.md`: exact Google Cloud, Apple Developer, Supabase provider, callback, secret-handling, and live verification instructions.

## Verification

Implementation is complete only after all of the following pass with fresh evidence:

- Focused reducer, route, OAuth, screen, profile, billing, analytics, and RLS tests.
- Full Jest suite.
- TypeScript with no emit.
- ESLint.
- Expo Doctor.
- iOS production export or equivalent release-compatible bundle validation.
- Visual screenshots at 390 by 844 for every approved screen, compared against the reference interior composition.
- Smaller/larger phone and keyboard accessibility checks.
- Cold launch: fresh install to Welcome.
- Resume: interrupted onboarding returns to the saved step and answers.
- Account creation: both providers reach profile sync and Premium.
- Logout: both providers return to Login.
- Login: completed existing accounts enter the app.
- No-bypass: a new provider identity chosen from Login is routed through onboarding.
- RevenueCat purchase, cancellation, unavailable offering, and restore paths.
- Live Supabase provider configuration and one real Google plus one real Apple sign-in on a release-compatible iOS build.
- Confirmation that provider secrets and raw onboarding answers are absent from git, Expo public variables, logs, and analytics.

Passing component tests alone does not establish device-visible or live-provider completion. Device routing, exact callback configuration, authoritative server profile status, and live provider login must be reported separately.
