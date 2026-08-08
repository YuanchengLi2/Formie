# Dashboard, Onboarding, Paywall, and Subscription Actions Implementation Plan

> **Execution rule:** Implement this plan with one agent only. Do not dispatch subagents. Work test-first, preserve unrelated worktree changes, and stage only the files listed by each task.

**Goal:** Repair the mobile analysis-balance header, remove the obsolete mobile subscription-detail page, apply the requested black-and-gold onboarding/auth treatment, rebuild the monthly paywall from the supplied reference without social proof, and add truthful confirmation/reason flows for cancellation and renewal on mobile and useformie.com.

**Reference image:** `assets/production/paywall/reference/paywall-reference.png` (the supplied image is also preserved as the original named ChatGPT image where available). Recreate its hierarchy with native React Native layout and the existing gold pyramid asset; do not render the reference image as a full-screen screenshot. The user-requested removal of faces, ratings, trust strip, and annual toggle overrides those elements in the reference.

**Architecture:** Keep the server entitlement and RevenueCat/provider receipt as the source of truth. Split the existing `/subscription` responsibilities: it remains the initial/expired monthly purchase paywall, while completed active accounts manage renewal from Settings through an in-place modal rather than a standalone detail page. Use one validated Supabase RPC to record enumerated cancellation/resume intent from both clients. Test Store actions mutate the sandbox entitlement only after confirmation; production actions record intent and then hand off to Apple App Store or Google Play because Formie cannot cancel or resume those receipts directly.

**Implementation status:** Tasks 1–9 are implemented. Focused mobile, related entitlement/quota/analytics, website tests, mobile and website typechecks/lint, and the website production build pass. Metro is restarted and its phone-facing iOS manifest plus exact LAN launch bundle return HTTP 200 with the new markers. Task 10 is complete for local verification, staging, commit, and push; production Vercel deployment remains blocked by the expired local Vercel session, and no physical phone is connected for screenshot evidence.

**Tech stack:** Expo Router, React Native, RevenueCat, Supabase/Postgres, Next.js 16, React 19, Jest, Node test runner, TypeScript, CSS.

## Locked product decisions and interpretations

- The latest sign-in instruction wins: the first onboarding screen has no filled or outlined sign-in box. It shows the text action `Already have an account? Sign in` and a larger primary `Get Started` button.
- Keep the exact structure and measurements of the `Welcome back` and onboarding account-access layouts. Change colors only: black surfaces, gold progress/accent treatment, light text, and provider controls adjusted to the same black/gold system.
- The Home header always shows a bounded numeric balance (`0/10`, `8/10`, or `—/10`). It never expands into `Subscription required` or `Purchase a subscription to use the app` copy.
- The Home header balance is a badge, not a progress meter. Full progress meters remain available only in roomy dashboard contexts.
- “Remove the screen when Subscription is clicked” means remove the completed-account mobile plan/quota/detail page. Settings remains the place to start management, but the action opens a compact modal over Settings. Initial purchase and expired repurchase still use the redesigned paywall.
- New purchases are monthly-only. Existing annual subscribers must continue to parse correctly and retain paid access, but annual upgrade controls and new annual sales copy are removed.
- Cancellation reasons are optional, enumerated, and privacy-safe: `too_expensive`, `not_using_enough`, `coaching_not_helpful`, `technical_issues`, `other`, and `prefer_not_to_say`. Do not collect free-form health, workout, or payment information in analytics.
- Cancellation is a two-stage flow: confirmation first, then reason selection, then the actual sandbox mutation or production-provider handoff.
- Resume is a one-stage confirmation followed by the sandbox mutation or provider handoff. It does not refill the current analysis period.

## Production behavior to preserve

1. **New or expired purchase in the mobile app:** RevenueCat selects the live monthly package, then iOS presents Apple StoreKit and Android presents Google Play Billing. Access changes only after the provider result and entitlement refresh confirm it.
2. **Active renewal cancellation:** Formie confirms intent and asks why. Test Store changes immediately to `active_cancelled`; production opens the provider’s subscription-management URL, where the customer must finish cancellation.
3. **Canceled but paid-through resume:** Formie confirms intent. Test Store switches back to `active_renewing`; production opens Apple/Google subscription management, where the customer completes renewal restoration. Existing access and the current `0–10` balance stay unchanged until the next verified billing boundary.
4. **Website:** useformie.com never pretends to process an App Store/Play Store charge. It records the confirmed action intent and opens the provider management page. Expired repurchase remains a native-app operation; the previously removed expired-state “Open Formie to resubscribe” CTA stays removed.

---

### Task 1: Lock the quota-badge contract and repair narrow-phone layout

**Files:**
- Modify: `src/components/analysis-quota-bar.tsx`
- Modify: `src/components/analysis-quota-bar.test.tsx`
- Modify: `src/screens/home/index.tsx`
- Modify: `src/screens/home/home.test.tsx`

- [ ] Change tests first to define two explicit variants: `badge` and `meter`. The badge must render only the normalized fraction, use a fixed bounded width (target 62–68 px), have no inner track, and expose a complete accessibility label.
- [ ] Add expired and purchase-state tests proving Home renders visible `0/10` and never renders `Subscription required` or `Purchase a subscription to use the app` in the top bar. Keep `—/10` while access is unresolved.
- [ ] Add a 320 px phone-layout assertion proving the wordmark, balance badge, gap, and 46 px Settings control fit within Home’s content width without flex growth or horizontal overflow.
- [ ] Run `npx jest --runInBand src/components/analysis-quota-bar.test.tsx src/screens/home/home.test.tsx`; confirm the new bounded-badge tests fail because the current compact variant has `minWidth: 128`, a `72` px track, and a long purchase label.
- [ ] Replace `compact?: boolean` with an explicit `variant?: "meter" | "badge"` contract. Centralize numeric normalization so both variants agree on safe limit, remaining count, percentage, and labels.
- [ ] Render the badge as a non-growing pill with `flexShrink: 0`, tabular numerals, and no progress track. Render the meter with a responsive `width: "100%"` container and no hard minimum that can exceed its parent.
- [ ] Change `HomeHeader` to use `variant="badge"`; preserve the wordmark and Settings button dimensions and reduce only the inter-control gap if needed for 320 px phones.
- [ ] Re-run the focused tests and expect all badge, accessibility, and existing Home-state cases to pass.

### Task 2: Remove the completed-account subscription detail screen and monthly-only annual upsell

**Files:**
- Modify: `src/app/subscription.tsx`
- Modify: `src/features/billing/subscription-view.ts`
- Modify: `src/features/billing/subscription-view.test.ts`
- Modify: `src/app/(tabs)/_layout.tsx`
- Modify: `src/app/(tabs)/(profile)/index.tsx`
- Modify: `src/screens/profile/index.tsx`
- Modify: `src/screens/profile/profile.test.tsx`

- [ ] Rewrite `subscription-view` tests so the resolver has only three entry outcomes: `verify`, `paywall`, and `completed_account`. Remove `planChange` and the annual-upgrade test; keep tests proving unknown is not treated as expired and expired goes to repurchase.
- [ ] Add Profile tests proving active and canceled users invoke an in-place management action and do not navigate to the old Subscription detail screen.
- [ ] Update the tabs quota-exhausted canceled-account action to open the Settings management flow rather than pushing the obsolete detail page. Use an Expo Router query flag only if needed to open the modal automatically; keep normal Settings navigation intact.
- [ ] Run the focused resolver/Profile tests and confirm they fail against the current active plan-card screen and annual upgrade branch.
- [ ] Delete the active/canceled plan card, analyses card, annual upgrade button, Test Store renewal block, and provider-management card from `src/app/subscription.tsx`.
- [ ] Keep the route’s `verify` loading state and monthly `PremiumScreen` state. If a completed active account reaches the route through a stale deep link, replace to Home/Settings rather than briefly rendering obsolete subscription details.
- [ ] Remove `annualPrice`, `annualPurchaseAvailable`, and annual purchase callbacks from this route. Do not delete annual entitlement parsing, annual plan labels for grandfathered users, or server receipt support.
- [ ] Change `ProfileScreen` so the Subscription section opens the new management modal/controller introduced in Task 6 while remaining on Settings.
- [ ] Re-run focused tests and `npx tsc --noEmit`.

### Task 3: Apply black-and-gold colors to returning-account access without moving layout

**Files:**
- Modify: `src/components/account-access-screen.tsx`
- Modify: `src/components/social-provider-buttons.tsx`
- Modify: `src/screens/auth/auth-screens.test.tsx`

- [ ] Update the auth tests first to retain every existing structural assertion: top row direction/gap, 296 px action width, 116 px action offset, 58 px provider heights, consent spacing, and login/onboarding copy.
- [ ] Replace only color assertions: screen/safe area `#050505`, gold progress bar, dark raised back control with gold glyph, light heading/body copy, dark consent boxes with gold selected state, and gold links.
- [ ] Define provider button colors that remain recognizable and accessible in the theme: Apple as a gold primary treatment, Google and Email as black/dark surfaces with gold borders and light text. Preserve icon sizes, button heights, radii, gap, order, and callbacks.
- [ ] Switch the status bar to light content. Do not add logos, subtitles, move controls, or alter consent behavior.
- [ ] Run `npx jest --runInBand src/screens/auth/auth-screens.test.tsx` and verify both `Welcome back` and `Save your progress`/continue-onboarding modes have identical layout measurements before and after the theme change.

### Task 4: Replace the first onboarding sign-in button with text and enlarge Get Started

**Files:**
- Modify: `src/screens/onboarding/approved-onboarding.tsx`
- Modify: `src/screens/onboarding/approved-onboarding.test.tsx`

- [ ] Change the welcome test to require one accessible text action named `Already have an account? Sign in`, no white/hollow sign-in button background or border, and the same `onSignIn` callback.
- [ ] Add assertions that the welcome `Get Started` control is taller and its label is larger than the normal onboarding `Continue` control while still fitting 375×667, 390×844, and 430×932 screens.
- [ ] Run the focused onboarding test and confirm it fails on the current white `Sign in` button and shared CTA size.
- [ ] In `NativeArtworkScreen`, render the sign-in text action separately from `GoldButton`. Keep the approved welcome illustration scaling and all other screen positions unchanged.
- [ ] Add a welcome-only size override to `GoldButton` (for example a `prominent` prop) rather than globally enlarging every onboarding CTA. Keep the existing density reductions for short phones.
- [ ] Place the text action directly above `Get Started` in the CTA region, with a 44 px touch target but no visible box. The exact visible copy is `Already have an account? Sign in`, with the final `Sign in` segment gold and the prefix muted/light.
- [ ] Re-run `npx jest --runInBand src/screens/onboarding/approved-onboarding.test.tsx`.

### Task 5: Rebuild the monthly paywall from the supplied image and remove social proof

**Files:**
- Modify: `src/screens/onboarding/premium-screen.tsx`
- Modify: `src/screens/onboarding/approved-onboarding.test.tsx`
- Verify/no source change unless needed: `assets/production/paywall/pro-card-background.png`

- [x] Update tests first to require the reference hierarchy: `Formie plans`, `Most popular`, the live monthly price, a clear `/mo` cadence, `Pro`, `What you unlock`, three readable benefit rows, and the monthly CTA; explicitly remove the annual toggle and social-proof strip requested by the user.
- [ ] Add negative assertions for `premium-social-proof`, `4.9/5`, avatar imagery, faces, stars used as ratings, `Trusted by`, annual selectors, annual prices, and yearly copy.
- [x] Add style assertions for the reference proportions: 20 px-plus header, 254 px gold hero, 64 px benefit rows with 36 px icons, 17 px benefit copy, and a 17 px monthly CTA.
- [x] Run the focused test first and confirm it fails on the previous `Upgrade to Formie Pro` composition, trust strip, smaller benefit copy, and `Continue with Pro` CTA.
- [x] Recompose `PremiumScreen` to match the supplied reference’s black page, gold pyramid hero, `Formie plans` header, `Most popular` badge, `Pro` price card, `What you unlock` rows, and bottom monthly CTA.
- [x] Use native geometric benefit icons matching the reference’s equalizer, target, and rising-chart artwork; do not use font-dependent Unicode glyph approximations.
- [ ] Remove the `socialProofAvatars` import and social-proof JSX/styles entirely. Do not remove the repository image file unless a final reference search proves it is unused and the user separately approves asset cleanup.
- [x] Keep the live RevenueCat monthly price and existing `sync_required` recovery behavior. `Start monthly - <price>/mo` starts only the monthly package; busy and unavailable states remain accessible and truthful.
- [x] Ensure content scrolls on a 667 px-tall phone while the CTA remains reachable above the safe-area inset, with no clipped price, hero, or benefit copy.
- [ ] Re-run the focused test and capture phone screenshots during Task 10.

### Task 6: Add mobile confirmation, cancellation reason, and resume flows

**Files:**
- Create: `src/features/billing/subscription-intent.ts`
- Create: `src/features/billing/subscription-intent.test.ts`
- Create: `src/components/subscription-intent-modal.tsx`
- Create: `src/components/subscription-intent-modal.test.tsx`
- Modify: `src/app/(tabs)/(profile)/index.tsx`
- Modify: `src/screens/profile/index.tsx`
- Modify: `src/screens/profile/profile.test.tsx`
- Modify: `src/app/(tabs)/_layout.tsx`

- [ ] Write pure state-machine tests for `closed → confirm_cancel → choose_reason → executing → closed/error` and `closed → confirm_resume → executing → closed/error`. Back/cancel at either stage must make no provider call and no Test Store mutation.
- [ ] Write component tests for dialog semantics, focus/read order, destructive cancel styling, all reason choices, optional “Prefer not to say,” resume confirmation, disabled busy actions, and error recovery.
- [ ] In `subscription-intent.ts`, define the action/reason enums, derive the correct action from `lifecycleState`, and implement one executor with injected dependencies for testability: `recordIntent`, `runTestControl`, `openProviderUrl`, and `refreshAccess`.
- [ ] For Test Store cancel, record the selected reason then run `cancel_at_period_end`, refresh, and show paid-through confirmation. For Test Store resume, record then run `uncancel` and refresh.
- [ ] For production cancel/resume, record intent best-effort and open `billing.subscription.managementURL`. Make analytics failure non-blocking, but show a real error if the provider URL cannot open.
- [ ] Render `SubscriptionIntentModal` over Settings. Active renewing copy starts with `Are you sure you want to cancel your subscription?`; only affirmative confirmation advances to `Why are you cancelling?`. Active canceled copy starts with `Are you sure you want to resubscribe?` and explicitly says it does not refill the current period.
- [ ] Keep cancellation from logging the user out and preserve access through `paidThrough`.
- [ ] Remove or route around raw Test Store cancel/uncancel buttons that bypass this flow, including the development lifecycle controls. Other Test Store simulation controls may remain.
- [ ] Run the focused billing, modal, Profile, and tab tests.

### Task 7: Persist privacy-safe subscription intent for mobile and website

**Files:**
- Create: `supabase/migrations/202608070005_subscription_management_intents.sql`
- Modify: `src/features/billing/subscription-intent.ts`
- Modify: `src/features/billing/subscription-intent.test.ts`
- Create: `website/lib/subscription-intent.ts`
- Create: `website/lib/subscription-intent.test.ts`

- [ ] Write helper tests proving only the allowed action, reason, surface, and store values are sent; no free-form text, email, device identifier, or payment data is accepted.
- [ ] Add `subscription_management_intent` to the `product_analytics_events.event_name` check without weakening existing event validation.
- [ ] Create `record_subscription_management_intent(p_action text, p_reason text, p_surface text, p_store text)` as a security-definer RPC with an empty search path. Validate action (`cancel`/`resume`), the cancellation reason enum, surface (`mobile`/`website`), and normalized store. Require `auth.uid()` and insert only the validated values.
- [ ] Revoke public/anon execution and grant only authenticated execution. Do not make analytics a prerequisite for provider management.
- [ ] Have both client helpers call the dedicated RPC instead of writing the analytics table directly.
- [ ] Validate the migration on a local/test Supabase database if available, then run existing analytics and subscription migration tests to prove the whitelist and RLS remain intact.

### Task 8: Simplify the useformie.com dashboard and add truthful action dialogs

**Files:**
- Modify: `website/app/manage-subscription/manage-subscription-client.tsx`
- Create: `website/app/manage-subscription/subscription-intent-dialog.tsx`
- Modify: `website/app/manage-subscription/manage-subscription.test.tsx`
- Modify: `website/app/globals.css`
- Use: `website/lib/subscription-intent.ts`

- [ ] Update render tests first to remove the authenticated dashboard’s decorative gold kickers: `FORMIE ACCOUNT`, `ACCOUNT INFRASTRUCTURE`, `KEEP FORMIE PRO`, `SUBSCRIPTION CONTROLS`, and `VERIFYING RENEWAL`. Keep meaningful neutral labels such as Current plan and Usage this period.
- [ ] Add tests requiring a dedicated `portal-cancel-card` for renewing accounts, a red outline/action, compact markup, `Cancel Subscription`, and no direct provider link that bypasses the confirmation flow.
- [ ] Update canceled-account tests to require `Resume Subscription` to open the confirmation flow rather than navigate immediately. Keep access-end, balance, provider, and no-false-reset assertions.
- [ ] Add pure dialog-state tests through `website/lib/subscription-intent.test.ts`; static-render tests should assert trigger labels and dialog wiring without pretending a server render proves interaction.
- [ ] In `ManageSubscriptionClient`, add local intent-dialog state and one action executor. Test Store uses the current Function only after the dialog flow finishes. Production records intent then calls `window.location.assign`/`window.open` for the verified provider URL.
- [ ] Render the custom accessible dialog with a title, explanatory copy, explicit No/Yes controls, reason choices for cancellation, busy state, and inline error. Escape closes only when no action is executing.
- [ ] Remove the small gold kicker spans from authenticated dashboard sections only; retain signed-out and blocking popup branding unless separately requested.
- [ ] Make the cancellation section substantially smaller than the current full-width 30×34 px management card: use a content-sized/max-width card, approximately 16–20 px padding, tighter copy, a muted red border/background, and a red destructive action. Preserve 44 px minimum targets and responsive full-width behavior on narrow phones.
- [ ] Increase both Manage Subscription action buttons to prominent touch targets (minimum 56 px height, larger label/padding, and a clear gap): the red Cancel Subscription action and the gold/neutral Resume/Manage action. Assert both sizes in the website tests and keep them full-width and stacked on narrow screens.
- [ ] Keep the resume card compact but gold/neutral rather than red. Confirmation copy must state that provider completion is still required and that current-period analyses are not replenished.
- [ ] Run `npm --prefix website test`, `npm --prefix website run lint`, and `npm --prefix website run build`.

### Task 9: Finish monthly-only product copy without breaking grandfathered annual access

**Files:**
- Modify: `src/screens/onboarding/premium-screen.tsx`
- Modify: `src/app/subscription.tsx`
- Modify: `src/features/billing/subscription-view.ts`
- Modify: `website/app/terms/page.tsx`
- Modify: `website/app/manage-subscription/manage-subscription.test.tsx`
- Modify: `docs/FORMIE_ONBOARDING_REVENUECAT_SETUP.md`

- [ ] Search all purchase-facing surfaces for annual/yearly selectors, prices, and upgrade actions. Remove them from new-purchase UI and update tests accordingly.
- [ ] Change Terms language for new sales to the monthly offering. If legal copy must mention grandfathered annual receipts, phrase it as existing-provider billing history rather than an available annual plan.
- [ ] Document that RevenueCat may still return historical annual entitlements and that clients must honor their paid-through date, even though the app no longer advertises or starts annual purchases.
- [ ] Keep server parsing, `planCode: "annual"`, annual account labels, and historical entitlement tests. Do not rewrite existing subscriber records.
- [ ] Run `rg -n 'Upgrade to Annual|Start annual|Annual plan|\$99\.99|/year' src website docs/FORMIE_ONBOARDING_REVENUECAT_SETUP.md` and inspect every remaining match as either historical-entitlement support or an error.

### Task 10: Full verification, phone QA, deployment, push, and app restart

**Files:**
- Verify all files above and preserve unrelated changes.

- [x] Run focused mobile tests:
  - `npx jest --runInBand src/components/analysis-quota-bar.test.tsx src/screens/home/home.test.tsx src/screens/auth/auth-screens.test.tsx src/screens/onboarding/approved-onboarding.test.tsx src/screens/profile/profile.test.tsx src/components/subscription-intent-modal.test.tsx src/features/billing/subscription-intent.test.ts src/features/billing/subscription-view.test.ts`
- [x] Run `npx tsc --noEmit` and `npm run lint`.
- [x] Run relevant Supabase analytics/subscription handler and migration tests.
- [x] Run `npm --prefix website test`, `npm --prefix website run lint`, and `npm --prefix website run build`.
- [x] Restart Expo with the repository’s dev-client LAN command and clear Metro cache. Verify the listener belongs to this Formie checkout, `/status` is running, the phone-facing iOS manifest and launch bundle return HTTP 200, and bundle markers contain the new quota, paywall, and dialog copy.
- [ ] Validate on a physical phone at minimum: 320/375-ish narrow width if available and the connected target phone. Capture the Home header at `0/10` and a nonzero balance, Welcome, Welcome back, continue-onboarding account access, paywall, cancel confirm, reason step, and resume confirm. Compilation/manifest checks do not count as device-visible proof.
- [ ] Run the website locally at desktop and phone widths. Verify no horizontal overflow, no authenticated gold kickers, compact red cancel card, keyboard/focus behavior, cancel two-step dialog, and resume confirmation.
- [ ] Deploy the website to production, verify the useformie.com alias and live bundle, and test production provider-link behavior without completing a real cancellation or charge. Blocked until the expired Vercel session is re-authenticated.
- [x] Review `git diff --check`, `git status --short`, and the exact staged diff. Commit only intended files, push the current branch, and report the commit SHA, remote branch, deployment URL, Metro process/manifest evidence, and physical-device evidence separately.

## Final acceptance checklist

- [ ] Home top-right shows a compact `0/10` for expired/purchase states and never displays `Subscription required`.
- [ ] The analysis balance does not stretch, collide, or overflow on a narrow phone.
- [ ] Completed active users no longer see the old mobile Subscription detail screen.
- [ ] Welcome back and continue-onboarding account access retain exact layout but use black/gold colors.
- [ ] First onboarding Welcome has a larger Get Started button and unboxed `Already have an account? Sign in` text action.
- [ ] Paywall follows the supplied black/gold reference hierarchy, uses live monthly pricing, has larger text, and contains no faces, `4.9/5`, ratings, trust strip, annual choice, or yearly price.
- [ ] Cancel requires confirmation and then a reason before any mutation/provider handoff.
- [ ] Resume requires confirmation before any mutation/provider handoff.
- [ ] Cancellation never logs out the account and never removes paid-through access.
- [ ] useformie.com authenticated dashboard has no decorative little gold kicker text.
- [ ] Website cancellation card is much smaller and outlined/actioned in red.
- [ ] Test Store paths are fully testable; production paths truthfully hand off to Apple/Google and do not claim completion before provider verification.
- [ ] Existing annual subscribers remain entitled through their verified paid period even though annual can no longer be newly purchased.
