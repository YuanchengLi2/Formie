# Premium Subscription Portal and Returning Auth Design

## Goal

Redesign the existing Formie website subscription-management page so it feels like a compact, trustworthy premium billing portal while keeping the current account shell and all live billing behavior. Fix the mobile Google authentication flow so a returning user with a genuinely completed server profile is not forced through onboarding again.

## Scope and constraints

- Keep the website account rail, mobile account navigation, signed-out authentication screen, error popups, expired-account gate, and existing route structure.
- Redesign only the authenticated active, canceled, and renewal-pending subscription dashboard.
- Preserve server-authoritative subscription, quota, plan, provider, paid-through, and renewal state. Do not invent payment-card data or receipt infrastructure.
- Preserve monthly and annual plan rendering because the current dashboard contract supports both, even though the reference copy is monthly-focused.
- Preserve Test Store cancellation/resume controls and Apple/Google external management links.
- Do not change entitlement, cancellation, logout, or quota semantics. Authentication and subscription access remain separate.
- Treat any server profile with `onboarding_completed = true` as a completed account. `onboarding_version` remains historical metadata and must not revoke access from a returning account.
- Brand-new OAuth users with no completed profile must still enter onboarding.
- Preserve unrelated changes in the dirty worktree.

## Chosen approach

### Portal

Use the existing `AccountPortalShell`, but replace the three large marketing-style cards with a single coherent billing information hierarchy:

1. Understated page heading: Subscription; Manage your Formie plan, usage, and billing.
2. Plan overview card with a restrained current-plan block and a contained billing-boundary block.
3. Usage card with remaining analyses, a horizontal progress bar, used count, and the correct reset/access boundary.
4. Billing details card with compact label/value rows for plan, price, status, next charge or access end, and billing provider.
5. Management card that adapts to active, canceled, and renewal-pending states without changing route or data source.
6. Compact billing-history and support footer with provider-specific language.

The portal will use `#050505` for the page, `#0c0c0b` and `#11110f` for surfaces, subtle gold borders, gold only for meaningful state and actions, and smaller typography except for the plan name and usage balance. Desktop content remains centered near 1200px. Tablet and phone layouts stack information blocks without horizontal overflow.

### Auth and onboarding

Define one pure profile-completion policy in the profile feature. A profile is complete when the server says `onboardingCompleted === true`; the version identifies which onboarding produced it but does not invalidate it. Use that shared policy in:

- root navigator route guards;
- launch-route resolution;
- the subscription verification gate.

Remove the version equality check from launch routing. The launch resolver will continue to distinguish new/incomplete users by `profileComplete === false`, so new Google identities cannot bypass onboarding. A returning legacy-complete Google account will route to Home when access is active or expired, and to Subscription while access is unresolved.

## Data and state behavior

### Active renewing

- Status: Active.
- Boundary: Next billing date.
- Usage boundary: Next reset.
- Management: provider-specific manage action; Test Store exposes the existing end-of-period cancellation control.
- Billing details show plan, price, status, next charge, and provider.

### Active canceled

- Status: Canceled.
- Boundary: Access ends.
- Usage must not claim a future reset.
- Management emphasizes resuming while preserving the current balance and billing period.
- Billing details show access-until rather than next charge.

### Renewal pending

- Status: Checking renewal.
- Boundary: Paid through.
- Usage says no new allowance is granted until renewal is verified.
- Management remains informational while the automatic dashboard refresh continues.

### Expired or not subscribed

Keep the current separate recovery gate and app deep link. This request does not change purchase infrastructure.

## Error handling and accessibility

- Keep dashboard refresh error and success status regions.
- Preserve safe numeric clamping in the usage meter and its ARIA meter attributes.
- Use semantic sections, headings, definition-list-style billing rows, accessible labels, focus-visible states, and reduced-motion-safe hover behavior.
- External store actions continue to open in a new tab with safe relationship attributes.
- Do not show a reset date for a canceled subscription.

## Files to change

### Website portal

- `website/app/manage-subscription/manage-subscription-client.tsx`
  - Add pure plan/status/presentation helpers.
  - Replace the active-dashboard JSX with plan overview, usage, billing details, management, and provider/support footer sections.
  - Preserve fetch, refresh scheduling, OAuth, logout, Test Store mutations, expired-state behavior, and server parsing.
- `website/app/globals.css`
  - Replace the authenticated portal card styling with the new black surface hierarchy, restrained gold treatment, compact type scale, hover/focus behavior, billing rows, and responsive stacking.
  - Keep unrelated global and marketing-site styling intact.
- `website/app/manage-subscription/manage-subscription.test.tsx`
  - Add or update render assertions for active, canceled, renewal-pending, zero-usage, billing-details, provider, and no-false-reset behavior.
  - Preserve signed-out, failure, missing-profile, Test Store, and expired-state coverage.

### Mobile authentication and route policy

- `src/features/profile/completion.ts`
  - Add the single pure `isCompletedProfile` policy used by all route gates.
- `src/features/profile/completion.test.ts`
  - Prove approved and legacy completed profiles are accepted while incomplete or absent profiles are rejected.
- `src/features/auth/launch-route.ts`
  - Make launch routing depend on completed status rather than a specific onboarding version.
- `src/features/auth/launch-route.test.ts`
  - Change the legacy returning-user expectation from Welcome to Home and retain new-user onboarding tests.
- `src/app/index.tsx`
  - Call the shared completion policy and pass the result into launch routing.
- `src/app/_layout.tsx`
  - Use the shared completion policy for onboarding, subscription, and completed-account route guards.
- `src/components/subscription-access-gate.tsx`
  - Use the same policy so the verification gate agrees with root navigation.

## Testing and verification

Follow test-driven development:

1. Add the failing returning-legacy-account tests and portal markup tests.
2. Run the focused mobile and website suites and confirm they fail for the expected missing behavior.
3. Implement the shared profile policy and portal presentation.
4. Re-run focused suites until green.
5. Run the mobile TypeScript check and relevant auth/profile/access/onboarding suites.
6. Run website tests, lint, and production build.
7. Render the portal at desktop and phone widths using deterministic dashboard fixtures or a local authenticated fixture path, then verify hierarchy, overflow, focus, and state-specific copy.

## Acceptance criteria

- The account rail/mobile navigation remains recognizable and functional.
- Active dashboard content reads as a billing portal rather than a marketing page.
- Plan, price, state, billing boundary, provider, quota, used count, and provider management actions are visible and consistent with the server snapshot.
- Canceled subscriptions show access ending and never promise a quota reset.
- Gold is restrained and no decorative crown or oversized management icon remains.
- The page has no horizontal overflow at common phone widths.
- A returning Google user whose server profile is completed under `legacy-complete-v1` does not restart onboarding.
- A new Google user or any user with `onboardingCompleted === false` still enters onboarding.
- Existing logout, cancellation, paid-through access, quota, Test Store, and expired-account behavior remains covered and passing.
