# Formie App Store Review Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan inline task-by-task. Do not use subagents; the repository instruction explicitly forbids them. Track every step with its checkbox and stop at each external-state gate for fresh verification.

**Goal:** Ship a replacement Formie iOS build whose subscription flow, authentication UI, in-app account deletion, public policies, backend data removal, App Store metadata, and reviewer instructions agree with one another and satisfy the material risks found in the rejected submission.

**Architecture:** Native screens expose only complete user actions and delegate privileged deletion to an authenticated Supabase Edge Function. The function derives the caller from the bearer token, recursively removes that user’s objects from both private Storage buckets, deletes privacy-linked analytics, and hard-deletes the Auth user so relational cascades run. The website and App Store listing describe the same behavior, and release gates separately prove source checks, deployments, a physical iOS candidate, App Store Connect processing, and the final review state.

**Tech Stack:** Expo SDK 54, React Native 0.81, Expo Router 6, TypeScript 5.9, Jest and Testing Library, RevenueCat `react-native-purchases` 10.6, Supabase JS 2.110, Supabase Edge Functions/Deno, PostgreSQL/pgTAP, Next.js 16, Node test runner, Vercel, EAS Build, TestFlight, and App Store Connect.

## Global Constraints

- Work inline in `C:\Users\yuanc\OneDrive\Documents\Formai`; never dispatch subagents.
- Preserve unrelated dirty worktree changes. Before every commit, stage only the exact files listed for that task and inspect `git diff --cached --name-status`.
- Existing uncommitted changes to the paywall artwork, privacy page, App Store screenshots, metadata test, and `store.config.json` are inputs to this release and must be reviewed, not overwritten.
- Existing changes to `jest.config.js`, `package.json`, and `package-lock.json` are outside this hardening plan unless a later failing verification proves they are required; do not include them in a hardening commit by accident.
- Solve the product causes: reachable restore and legal actions, dynamic Store price, complete account deletion, only working auth choices, final policies, and accurate live metadata. Do not substitute reviewer-only wording for missing behavior.
- Keep Apple sign-in as the only visible authentication method for this release. Do not expose Google or email until their full product flows are approved separately.
- Use the StoreKit/RevenueCat localized price. Never hardcode `$9.99` as authoritative offer text when the monthly package is unavailable.
- Account deletion must remain available immediately even when an Apple subscription is active. It must warn that deletion does not cancel Apple billing and offer subscription management without making management mandatory.
- The deletion request never accepts a user ID. The server derives identity from the verified bearer token.
- Remove user-owned objects from `analysis-videos` and `analysis-artifacts` before hard-deleting the Auth user.
- Retain device-wide capture preferences after deletion because they are not scoped to an account. Clear account-scoped onboarding state, React Query cache, RevenueCat identity, and Supabase session.
- Do not claim Apple token revocation. The current Supabase OAuth flow does not expose the required Apple token; provide manual Apple authorization guidance and do not block deletion on that external step.
- Do not invent App Review contact details, demo credentials, trader declarations, privacy-label answers, or business/legal facts. Read the current external state and stop for owner input when a required fact is absent.
- EAS build and submission consume cloud resources. Build only after all local, backend, and website gates pass.
- A GitHub commit, source test, Supabase deploy, Vercel deploy, TestFlight upload, StoreKit sandbox purchase, and App Store review submission are separate evidence boundaries.

## File Map and Interface Contracts

### Mobile presentation and routing

- `src/screens/onboarding/premium-screen.tsx` owns the accessible subscription offer, restore action, legal links, and purchase/restore status.
- `src/screens/onboarding/approved-onboarding.tsx`, `src/app/onboarding/[step].tsx`, and `src/app/subscription.tsx` pass billing and legal callbacks without duplicating subscription logic.
- `src/components/social-provider-buttons.tsx`, `src/components/account-access-screen.tsx`, `src/screens/auth/index.tsx`, and auth routes expose Apple only.
- `src/screens/profile/index.tsx` owns deletion confirmation state and destructive-action UX.
- `src/app/(tabs)/(profile)/index.tsx` owns deletion orchestration and post-success cleanup.
- `src/features/account-deletion/api.ts` owns the typed HTTP contract to `delete-account`.

### Backend and database

- `supabase/functions/delete-account/storage.ts` recursively enumerates and validates user-owned Storage paths.
- `supabase/functions/delete-account/handler.ts` owns authenticated stage ordering and safe responses.
- `supabase/functions/delete-account/index.ts` adapts the handler to Supabase Auth, Storage, PostgREST, and Auth Admin APIs.
- `supabase/migrations/202608150001_account_deletion_privacy.sql` changes analytics ownership deletion from nulling to cascading.
- `supabase/tests/account-deletion.sql` proves every public foreign key to `auth.users` cascades after the migration.

### Website and store state

- `website/app/terms/page.tsx`, `website/app/privacy/page.tsx`, and `website/app/retention/page.tsx` state the production rules.
- `website/app/privacy-choices/page.tsx` is the stable User Privacy Choices destination.
- `website/components/site-shell.tsx` makes that destination discoverable.
- `store.config.json` is the source-controlled EAS metadata baseline, including review notes but not invented contact data.
- `scripts/store-metadata.test.cjs` validates legal URLs, review notes, and release wording.

### Shared signatures

```ts
export type PremiumScreenProps = {
  price: string;
  purchaseAvailable: boolean;
  busy: boolean;
  state?: PurchaseState;
  error?: string | null;
  restoreMessage?: string | null;
  onBack?: () => void;
  onPurchase: () => void;
  onPurchasePlan?: (plan: "monthly") => void;
  onRetrySync?: () => void;
  onRestore: () => void;
  onOpenTerms: () => void;
  onOpenPrivacy: () => void;
};

export type DeleteAccountInput = {
  accessToken: string;
  baseUrl?: string;
  fetcher?: typeof fetch;
};

export type DeleteAccountStage = "storage" | "analytics" | "auth_user";

export class AccountDeletionError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
    readonly stage: DeleteAccountStage | null,
  );
}

export async function deleteAccount(input: DeleteAccountInput): Promise<void>;

export type AccountDeletionDependencies = {
  authenticate(request: Request): Promise<string>;
  listUserFiles(bucket: AccountStorageBucket, userId: string): Promise<string[]>;
  removeFiles(bucket: AccountStorageBucket, userId: string, paths: string[]): Promise<void>;
  deleteAnalytics(userId: string): Promise<void>;
  deleteAuthUser(userId: string): Promise<void>;
};
```

---

### Task 1: Preserve the Release Baseline and Complete Store-Metadata Regression Coverage

**Files:**

- Modify: `store.config.json`
- Modify: `scripts/store-metadata.test.cjs`
- Inspect without staging: `jest.config.js`, `package.json`, `package-lock.json`
- Inspect without rewriting: `assets/app-store/ios/6.7/01-coaching.png`, `02-process.png`, `03-subscription.png`

**Interfaces:**

- Consumes: current EAS metadata pulled from App Store Connect and the approved standard EULA URL.
- Produces: a source-controlled English listing and review-note contract that Tasks 9 and 12 validate before external mutation.

- [ ] **Step 1: Record the exact dirty baseline and protect unrelated files**

Run:

```powershell
git status --short
git diff -- jest.config.js package.json package-lock.json
git diff -- src/screens/onboarding/premium-screen.tsx src/screens/onboarding/approved-onboarding.test.tsx website/app/privacy/page.tsx website/app/privacy/page.test.tsx
Get-ChildItem assets/app-store/ios/6.7 -File | Select-Object Name,Length
```

Expected: the known dirty files are visible; no file is stashed, reset, or overwritten. Save the command output in the execution notes so later commits can prove their scope.

- [ ] **Step 2: Extend the metadata test and observe the missing review contract**

Add assertions to `scripts/store-metadata.test.cjs` using these exact constants and requirements:

```js
const PRODUCTION_URLS = {
  privacyPolicyUrl: "https://useformie.com/privacy",
  supportUrl: "https://useformie.com/support",
  marketingUrl: "https://useformie.com",
};

test("App Store metadata uses production legal URLs and complete review notes", () => {
  const config = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "store.config.json"), "utf8"));
  const info = config.apple.info["en-US"];
  assert.equal(info.privacyPolicyUrl, PRODUCTION_URLS.privacyPolicyUrl);
  assert.equal(info.supportUrl, PRODUCTION_URLS.supportUrl);
  assert.equal(info.marketingUrl, PRODUCTION_URLS.marketingUrl);
  assert.match(info.description, /https:\/\/www\.apple\.com\/legal\/internet-services\/itunes\/dev\/stdeula\//);
  assert.doesNotMatch(JSON.stringify(config), /\bdraft\b|finalized before public release|lorem ipsum/i);
  assert.match(config.apple.review.notes, /Restore Purchases/);
  assert.match(config.apple.review.notes, /Settings > Delete Account/);
  assert.match(config.apple.review.notes, /Sign in with Apple/);
});
```

Run:

```powershell
node --test scripts/store-metadata.test.cjs
```

Expected: FAIL because `apple.review.notes` is absent.

- [ ] **Step 3: Add accurate review notes without inventing contact fields**

Add this exact `review.notes` content under `apple` in `store.config.json`. If `eas metadata:pull` later supplies `firstName`, `lastName`, `email`, or `phone`, preserve those live values; do not create replacements in this task.

```text
Sign-in and account setup:
1. Launch Formie and complete the onboarding screens.
2. Tap Sign in with Apple. Apple is the only account method shown in this release; no separate demo password is required.

Subscription:
1. The Formie Pro monthly offer appears after account setup or from Settings > Subscription.
2. The screen shows the localized App Store price, auto-renewal disclosure, Terms of Use, Privacy Policy, and Restore Purchases.
3. Apple controls the purchase sheet and subscription management.

Core review flow:
1. From Home, start an analysis and select or confirm the exercise.
2. Record a short exercise set. Camera access and a physical device are required for recording.
3. Submit the recording and wait for the analysis to complete.
4. Open the result to review evidence-linked coaching.

Account deletion:
1. Open Settings.
2. Tap Delete Account.
3. Review the subscription warning, enter DELETE, and confirm Delete Account Now.
4. Deletion removes the Formie account and Formie-controlled uploaded/derived data. It does not cancel Apple billing; Manage Apple Subscription is available in the confirmation.

Terms of Use (EULA): https://www.apple.com/legal/internet-services/itunes/dev/stdeula/
Privacy choices: https://useformie.com/privacy-choices
```

- [ ] **Step 4: Verify metadata text and screenshot dimensions**

Run:

```powershell
node --test scripts/store-metadata.test.cjs
Add-Type -AssemblyName System.Drawing
Get-ChildItem assets/app-store/ios/6.7 -File | ForEach-Object {
  $image = [System.Drawing.Image]::FromFile($_.FullName)
  try { "{0} {1}x{2}" -f $_.Name,$image.Width,$image.Height } finally { $image.Dispose() }
}
```

Expected: metadata tests PASS; all three screenshots report `1290x2796`.

- [ ] **Step 5: Commit only metadata baseline files**

```powershell
git add -- store.config.json scripts/store-metadata.test.cjs assets/app-store/ios/6.7/01-coaching.png assets/app-store/ios/6.7/02-process.png assets/app-store/ios/6.7/03-subscription.png
git diff --cached --name-status
git commit -m "fix: complete App Store review metadata"
```

Expected staged scope: only `store.config.json`, the metadata test, and the three reviewed screenshots. If a screenshot does not reflect the new native paywall after Task 2, leave screenshots unstaged here and regenerate them in Task 9.

### Task 2: Render a Complete Native Subscription Offer and Reachable Restore Flow

**Files:**

- Modify: `src/screens/onboarding/premium-screen.tsx`
- Modify: `src/screens/onboarding/approved-onboarding.tsx`
- Modify: `src/screens/onboarding/approved-onboarding.test.tsx`
- Modify: `src/app/onboarding/[step].tsx`
- Modify: `src/app/subscription.tsx`
- Modify: `src/features/auth/onboarding-auth-route.test.tsx`
- Create: `src/features/billing/subscription-route.test.tsx`

**Interfaces:**

- Consumes: `BillingContextValue.restore(): Promise<boolean>`, `restoreMessage`, `PurchaseState`, and `getLegalLinks()`.
- Produces: the `PremiumScreenProps` contract in the File Map; onboarding and standalone subscription routes with identical offer, restore, and legal behavior.

- [ ] **Step 1: Write failing PremiumScreen behavior tests**

In the premium cases of `approved-onboarding.test.tsx`, add `onRestore`, pass it through `renderStep`, and assert:

```tsx
expect(screen.getByText("$12.49 per month")).toBeTruthy();
expect(screen.getByText(/automatically renews each month until cancelled/i)).toBeTruthy();
expect(screen.getByRole("button", { name: "Restore Purchases" })).toBeTruthy();
expect(screen.getByRole("link", { name: "Terms of Use" })).toBeTruthy();
expect(screen.getByRole("link", { name: "Privacy Policy" })).toBeTruthy();

await fireEvent.press(screen.getByRole("button", { name: "Restore Purchases" }));
await fireEvent.press(screen.getByRole("link", { name: "Terms of Use" }));
await fireEvent.press(screen.getByRole("link", { name: "Privacy Policy" }));

expect(props.onRestore).toHaveBeenCalledTimes(1);
expect(props.onOpenTerms).toHaveBeenCalledTimes(1);
expect(props.onOpenPrivacy).toHaveBeenCalledTimes(1);
```

Add cases for `purchaseAvailable={false}`, `state="restoring"`, and `restoreMessage="No active Formie subscription was found."`. The unavailable case must show `Plan unavailable` without substituting `$9.99`; the restoring case must disable duplicate restore; the message must use `accessibilityLiveRegion="polite"`.

- [ ] **Step 2: Run the focused screen test and verify failure**

Run:

```powershell
npx jest --runInBand src/screens/onboarding/approved-onboarding.test.tsx
```

Expected: FAIL because restore/legal props and native offer text do not exist.

- [ ] **Step 3: Replace authoritative raster offer details with native controls**

Modify `premium-screen.tsx` to preserve the current `paywall-reference-no-social-proof.png` only as decorative artwork. Cover or crop any baked-in authoritative price/period/CTA text and render the following native block below the feature artwork:

```tsx
<Text accessibilityRole="header" style={styles.offerTitle}>Formie Pro</Text>
<Text style={styles.offerPrice}>
  {purchaseAvailable ? `${price} per month` : "Monthly plan unavailable"}
</Text>
<Text style={styles.renewalDisclosure}>
  Payment is charged to your Apple ID. The subscription automatically renews each month until cancelled at least 24 hours before the end of the current period. Manage or cancel it in Apple subscription settings.
</Text>
```

Render the purchase button in normal document flow after this text instead of placing it at a source-image coordinate. Keep the existing state semantics:

- `sync_required` calls `onRetrySync` and labels the button `Check purchase`.
- `purchasing` and `reconciling` disable duplicate purchase.
- no monthly package disables purchase and labels it `Plan unavailable`.
- `restoring` disables both purchase and restore until the Store operation finishes.

Render these controls below the purchase CTA:

```tsx
<Pressable accessibilityRole="button" accessibilityLabel="Restore Purchases" disabled={storeBusy} onPress={onRestore}>
  <Text>Restore Purchases</Text>
</Pressable>
{restoreMessage ? <Text accessibilityLiveRegion="polite">{restoreMessage}</Text> : null}
<View style={styles.legalRow}>
  <Pressable accessibilityRole="link" accessibilityLabel="Terms of Use" onPress={onOpenTerms}><Text>Terms of Use</Text></Pressable>
  <Pressable accessibilityRole="link" accessibilityLabel="Privacy Policy" onPress={onOpenPrivacy}><Text>Privacy Policy</Text></Pressable>
</View>
```

Remove the hidden accessibility summary that repeats baked-in offer details. Native text and controls become the accessibility tree.

- [ ] **Step 4: Wire the shared premium contract through onboarding**

Add to `ApprovedOnboardingScreenProps`:

```ts
restoreMessage?: string | null;
onRestore: () => void;
```

In the premium branch, pass `restoreMessage`, `onRestore`, `onOpenTerms`, and `onOpenPrivacy` to `PremiumScreen`.

In `src/app/onboarding/[step].tsx`, pass:

```tsx
restoreMessage={billing.restoreMessage}
onRestore={() => void billing.restore()}
onOpenTerms={() => { if (legal) void Linking.openURL(legal.termsUrl); }}
onOpenPrivacy={() => { if (legal) void Linking.openURL(legal.privacyUrl); }}
```

Keep the existing purchase callback and entitlement reconciliation unchanged.

- [ ] **Step 5: Write and run failing standalone route tests**

Create `src/features/billing/subscription-route.test.tsx`. Mock authenticated auth, inactive access, premium-required onboarding, router, legal config, Linking, and billing. Capture `PremiumScreen` props and assert:

```tsx
expect(capturedProps.restoreMessage).toBe("Purchase restored.");
await act(async () => { (capturedProps.onRestore as () => void)(); });
await act(async () => { (capturedProps.onOpenTerms as () => void)(); });
await act(async () => { (capturedProps.onOpenPrivacy as () => void)(); });
expect(mockRestore).toHaveBeenCalledTimes(1);
expect(Linking.openURL).toHaveBeenNthCalledWith(1, "https://useformie.com/terms");
expect(Linking.openURL).toHaveBeenNthCalledWith(2, "https://useformie.com/privacy");
```

Run:

```powershell
npx jest --runInBand src/features/billing/subscription-route.test.tsx src/features/auth/onboarding-auth-route.test.tsx
```

Expected: FAIL until the standalone route imports `expo-linking`, resolves `getLegalLinks()`, and passes restore/legal props.

- [ ] **Step 6: Wire the standalone route and update route mocks**

In `src/app/subscription.tsx`:

- import `expo-linking` and `getLegalLinks`;
- resolve legal links with the existing fail-closed pattern;
- use `billing.plans.monthly?.priceString ?? "Unavailable"` rather than `$9.99`;
- pass `restoreMessage`, `onRestore`, `onOpenTerms`, and `onOpenPrivacy`;
- do not navigate to paid content merely because restore returned `true`; refresh access and complete onboarding using the same `completePurchase()` reconciliation path.

Update `onboarding-auth-route.test.tsx` billing and legal mocks to include `restoreMessage`, `retentionUrl`, and stable `restore` functions. Add an assertion that the premium route forwards the exact restore callback and production legal URLs.

- [ ] **Step 7: Run all affected subscription tests**

Run:

```powershell
npx jest --runInBand src/screens/onboarding/approved-onboarding.test.tsx src/features/auth/onboarding-auth-route.test.tsx src/features/billing/subscription-route.test.tsx src/features/billing/billing-provider.test.tsx
```

Expected: PASS with no fixed fallback price in either route.

- [ ] **Step 8: Commit the subscription-flow correction**

```powershell
git add -- src/screens/onboarding/premium-screen.tsx src/screens/onboarding/approved-onboarding.tsx src/screens/onboarding/approved-onboarding.test.tsx ':(literal)src/app/onboarding/[step].tsx' src/app/subscription.tsx src/features/auth/onboarding-auth-route.test.tsx src/features/billing/subscription-route.test.tsx
git diff --cached --name-status
git commit -m "fix: complete native subscription disclosures"
```

### Task 3: Remove Unavailable Authentication Methods and Add a Deletion-Success Notice Contract

**Files:**

- Modify: `src/components/social-provider-buttons.tsx`
- Modify: `src/components/account-access-screen.tsx`
- Modify: `src/screens/auth/index.tsx`
- Modify: `src/screens/auth/auth-screens.test.tsx`
- Modify: `src/screens/onboarding/approved-onboarding.tsx`
- Modify: `src/screens/onboarding/approved-onboarding.test.tsx`
- Modify: `src/app/onboarding/[step].tsx`
- Modify: `src/app/(auth)/login.tsx`
- Modify: `src/features/auth/onboarding-auth-route.test.tsx`

**Interfaces:**

- Consumes: existing Apple OAuth service; `accountDeleted=1` query parameter produced by Task 7.
- Produces: Apple-only account-access UI and a `notice?: string | null` presentation prop for signed-out account-deletion confirmation.

- [ ] **Step 1: Rewrite auth-screen tests to specify only functional UI**

Replace expectations for Google, email, and “Coming soon” with:

```tsx
expect(screen.getByRole("button", { name: "Sign in with Apple" })).toBeTruthy();
expect(screen.queryByText("Sign in with Google")).toBeNull();
expect(screen.queryByText("Sign in with Email")).toBeNull();
expect(screen.queryByText("Continue with email")).toBeNull();
expect(screen.queryByText("Coming soon")).toBeNull();
expect(screen.queryByTestId("provider-google")).toBeNull();
expect(screen.queryByTestId("provider-email")).toBeNull();
```

Add a login notice assertion:

```tsx
const screen = render(withSafeArea(
  <SocialLoginScreen onOAuth={jest.fn()} onCreateAccount={jest.fn()} busyProvider={null} notice="Your Formie account was deleted." />,
));
expect(screen.getByText("Your Formie account was deleted.").props.accessibilityLiveRegion).toBe("polite");
```

Update the onboarding test to press only Apple and assert `onOAuth("apple")` once.

- [ ] **Step 2: Run tests and verify current unfinished controls fail the contract**

Run:

```powershell
npx jest --runInBand src/screens/auth/auth-screens.test.tsx src/screens/onboarding/approved-onboarding.test.tsx
```

Expected: FAIL because Google/email controls still render and `notice` is unsupported.

- [ ] **Step 3: Simplify the provider component to Apple only**

In `social-provider-buttons.tsx`:

- remove `BlurView`, Google/email images, `ReactNode`, and `UnavailableProvider`;
- remove `mode` and `onEmail` props;
- retain only `onOAuth`, `busyProvider`, and `disabled`;
- render only `provider-apple`;
- delete styles used exclusively by unavailable controls.

Use this narrowed UI callback:

```ts
onOAuth: (provider: "apple") => void;
```

Backend `SocialProvider` support remains untouched.

- [ ] **Step 4: Propagate the Apple-only contract through account screens and routes**

In `account-access-screen.tsx`, remove the required `onEmail` prop and call:

```tsx
<SocialProviderButtons disabled={disabled} busyProvider={busyProvider} onOAuth={onOAuth} />
```

Add `notice?: string | null` and render it before errors:

```tsx
{notice ? <Text accessibilityLiveRegion="polite" style={styles.notice}>{notice}</Text> : null}
```

In `src/screens/auth/index.tsx`, remove `onEmail`, add `notice`, and forward it. In `ApprovedOnboardingScreenProps` and `AccountScreen`, remove `onEmail`. Remove the email navigation callback from onboarding and login routes. Do not delete email service files because they are outside the visible release surface and remain covered by existing service tests.

- [ ] **Step 5: Parse the account-deleted route signal into exact user guidance**

In `src/app/(auth)/login.tsx`, extend search parameters:

```ts
const { error: routeError, returnTo, accountDeleted } = useLocalSearchParams<{
  error?: string;
  returnTo?: string;
  accountDeleted?: string;
}>();
```

Pass this exact notice when the first parameter value is `"1"`:

```text
Your Formie account and Formie-controlled data were deleted. If you used Sign in with Apple, you can also remove Formie in Apple ID Settings under Sign-In & Security > Sign in with Apple.
```

This notice does not claim Apple authorization was revoked.

- [ ] **Step 6: Run the auth and route tests**

Run:

```powershell
npx jest --runInBand src/screens/auth/auth-screens.test.tsx src/screens/onboarding/approved-onboarding.test.tsx src/features/auth/onboarding-auth-route.test.tsx
```

Expected: PASS; repository search returns no rendered “Coming soon” authentication controls:

```powershell
rg -n "provider-google|provider-email|Coming soon" src/components src/screens src/app -g '*.tsx'
```

Expected search result: no auth-control matches. Marketing-site Android availability copy is outside this assertion.

- [ ] **Step 7: Commit the release-auth surface**

```powershell
git add -- src/components/social-provider-buttons.tsx src/components/account-access-screen.tsx src/screens/auth/index.tsx src/screens/auth/auth-screens.test.tsx src/screens/onboarding/approved-onboarding.tsx src/screens/onboarding/approved-onboarding.test.tsx ':(literal)src/app/onboarding/[step].tsx' ':(literal)src/app/(auth)/login.tsx' src/features/auth/onboarding-auth-route.test.tsx
git diff --cached --name-status
git commit -m "fix: show only production authentication methods"
```

### Task 4: Build the Server-Authoritative Account-Deletion Backend

**Files:**

- Create: `supabase/functions/delete-account/storage.ts`
- Create: `supabase/functions/delete-account/storage.test.ts`
- Create: `supabase/functions/delete-account/handler.ts`
- Create: `supabase/functions/delete-account/handler.test.ts`
- Create: `supabase/functions/delete-account/index.ts`
- Modify: `supabase/config.toml`
- Create: `supabase/migrations/202608150001_account_deletion_privacy.sql`
- Create: `supabase/tests/account-deletion.sql`

**Interfaces:**

- Consumes: shared `createAdminClient()`, `requireUserId()`, `corsHeaders`, `preflight`, Supabase Storage list/remove, PostgREST delete, and `auth.admin.deleteUser(userId, false)`.
- Produces: authenticated `POST /functions/v1/delete-account` accepting `{ "confirmation": "DELETE" }` and returning either `{ "deleted": true }` or `{ "message", "code", "stage" }`.

- [ ] **Step 1: Write failing recursive Storage tests**

Create `storage.test.ts` with a fake page loader. Cover all of these cases:

```ts
it("paginates files and recursively visits nested folders", async () => {
  const paths = await listUserObjectPaths("analysis-videos", "user-1", async (_bucket, prefix, offset) => {
    const pages: Record<string, Record<number, StorageListEntry[]>> = {
      "user-1": {
        0: [{ name: "session-a", id: null, metadata: null }, { name: "root.mp4", id: "file-1", metadata: {} }],
        100: [],
      },
      "user-1/session-a": {
        0: [{ name: "keyframes", id: null, metadata: null }, { name: "input.mp4", id: "file-2", metadata: {} }],
        100: [],
      },
      "user-1/session-a/keyframes": {
        0: [{ name: "00.jpg", id: "file-3", metadata: {} }],
        100: [],
      },
    };
    return pages[prefix]?.[offset] ?? [];
  });
  expect(paths).toEqual([
    "user-1/root.mp4",
    "user-1/session-a/input.mp4",
    "user-1/session-a/keyframes/00.jpg",
  ]);
});
```

Add tests that reject `../`, empty names, slashes embedded in an entry name, and any final path whose first normalized segment is not exactly `user-1`. Add a batching test proving `removeUserObjects()` calls the remover with at most 100 paths per request.

- [ ] **Step 2: Run Storage tests and observe the missing module**

Run:

```powershell
npx jest --runInBand supabase/functions/delete-account/storage.test.ts
```

Expected: FAIL because `storage.ts` does not exist.

- [ ] **Step 3: Implement bounded recursive listing and removal**

Create these public contracts in `storage.ts`:

```ts
export const accountStorageBuckets = ["analysis-videos", "analysis-artifacts"] as const;
export type AccountStorageBucket = typeof accountStorageBuckets[number];

export type StorageListEntry = {
  name: string;
  id: string | null;
  metadata: Record<string, unknown> | null;
};

export type StoragePageLoader = (
  bucket: AccountStorageBucket,
  prefix: string,
  offset: number,
  limit: number,
) => Promise<StorageListEntry[]>;

export async function listUserObjectPaths(
  bucket: AccountStorageBucket,
  userId: string,
  loadPage: StoragePageLoader,
): Promise<string[]>;

export async function removeUserObjects(
  bucket: AccountStorageBucket,
  userId: string,
  paths: string[],
  removeBatch: (bucket: AccountStorageBucket, paths: string[]) => Promise<void>,
): Promise<void>;
```

Use `limit = 100`, increment offset until a page contains fewer than 100 entries, recurse only when `entry.id === null && entry.metadata === null`, sort returned paths for deterministic tests, and maintain a visited-prefix set. Validate every entry with:

```ts
function appendSafeSegment(prefix: string, name: string): string {
  if (!name || name === "." || name === ".." || name.includes("/") || name.includes("\\")) {
    throw new Error("UNSAFE_STORAGE_PATH");
  }
  return `${prefix}/${name}`;
}

function assertOwnedPath(userId: string, path: string): void {
  const segments = path.split("/");
  if (segments[0] !== userId || segments.some((segment) => !segment || segment === "." || segment === "..")) {
    throw new Error("UNSAFE_STORAGE_PATH");
  }
}
```

Do not silently skip unsafe entries; fail the deletion so the server cannot claim complete removal.

- [ ] **Step 4: Write failing handler ordering, auth, and idempotency tests**

Create `handler.test.ts` with injected dependencies. The core success assertion must prove this exact order across both buckets:

```ts
expect(events).toEqual([
  "authenticate",
  "list:analysis-videos",
  "remove:analysis-videos",
  "list:analysis-artifacts",
  "remove:analysis-artifacts",
  "delete:analytics",
  "delete:auth_user",
]);
```

Add independent tests for:

- method other than `POST` returns 405;
- malformed body or confirmation other than exact `DELETE` returns 400 before authentication;
- unauthorized returns 401 and calls no privileged dependency;
- a client-supplied `userId` field is rejected with 400;
- already-empty buckets still advance to analytics/Auth deletion;
- either list/remove failure returns 500 with `stage: "storage"` and never deletes analytics/Auth user;
- analytics failure returns `stage: "analytics"` and never deletes Auth user;
- Auth Admin failure returns `stage: "auth_user"`;
- error bodies never contain the bearer token, user ID, email, or object paths.

- [ ] **Step 5: Run the handler test and verify failure**

Run:

```powershell
npx jest --runInBand supabase/functions/delete-account/handler.test.ts
```

Expected: FAIL because `handler.ts` does not exist.

- [ ] **Step 6: Implement the handler’s stage machine**

Create `handler.ts` with these response codes:

```ts
type DeleteAccountErrorCode =
  | "METHOD_NOT_ALLOWED"
  | "INVALID_BODY"
  | "UNAUTHORIZED"
  | "STORAGE_DELETE_FAILED"
  | "ANALYTICS_DELETE_FAILED"
  | "AUTH_USER_DELETE_FAILED";
```

Parse JSON as a strict record: keys must equal `confirmation` only and its value must equal `DELETE`. Authenticate once, then iterate `accountStorageBuckets`. For each bucket, list and remove paths before continuing. Wrap each stage separately and return a generic user-safe message plus its stage. Return `{ deleted: true }` only after `deleteAuthUser` resolves.

The handler may log only an error code and stage through an injected logger or `console.error({ code, stage })`; never log the caught provider object because it may contain paths or identifiers.

- [ ] **Step 7: Implement the Supabase adapter**

Create `index.ts` using the shared preflight/CORS pattern. Adapt Storage as follows:

```ts
listUserFiles: (bucket, userId) => listUserObjectPaths(
  bucket,
  userId,
  async (selectedBucket, prefix, offset, limit) => {
    const { data, error } = await admin.storage.from(selectedBucket).list(prefix, {
      limit,
      offset,
      sortBy: { column: "name", order: "asc" },
    });
    if (error) throw error;
    return (data ?? []).map((entry) => ({
      name: entry.name,
      id: entry.id ?? null,
      metadata: entry.metadata ?? null,
    }));
  },
),
removeFiles: (bucket, userId, paths) => removeUserObjects(bucket, userId, paths, async (selectedBucket, batch) => {
  const { error } = await admin.storage.from(selectedBucket).remove(batch);
  if (error) throw error;
}),
```

The handler calls `removeFiles(bucket, userId, paths)` with the ID returned by `authenticate()`. Keep this signature identical in the shared contract, handler, adapter, and tests; do not use module-global user state.

Implement analytics and Auth deletion:

```ts
deleteAnalytics: async (userId) => {
  const { error } = await admin.from("product_analytics_events").delete().eq("user_id", userId);
  if (error) throw error;
},
deleteAuthUser: async (userId) => {
  const { error } = await admin.auth.admin.deleteUser(userId, false);
  if (error) throw error;
},
```

Register `[functions.delete-account]` with `verify_jwt = true` in `supabase/config.toml`.

- [ ] **Step 8: Write the analytics cascade migration and database contract test**

Create `202608150001_account_deletion_privacy.sql`:

```sql
alter table public.product_analytics_events
  drop constraint if exists product_analytics_events_user_id_fkey;

alter table public.product_analytics_events
  add constraint product_analytics_events_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;

comment on constraint product_analytics_events_user_id_fkey
  on public.product_analytics_events
  is 'Remove identity-linked product analytics when the owning account is deleted.';
```

Create `supabase/tests/account-deletion.sql` with pgTAP:

```sql
begin;
select plan(3);

select is(
  (select confdeltype::text
   from pg_constraint
   where conrelid = 'public.product_analytics_events'::regclass
     and conname = 'product_analytics_events_user_id_fkey'),
  'c',
  'product analytics cascade when an auth user is deleted'
);

select is(
  (select count(*)::integer
   from pg_constraint
   where contype = 'f'
     and confrelid = 'auth.users'::regclass
     and connamespace = 'public'::regnamespace
     and confdeltype <> 'c'),
  0,
  'all public foreign keys to auth users cascade'
);

select is(
  (select count(*)::integer
   from storage.buckets
   where id in ('analysis-videos', 'analysis-artifacts') and public = false),
  2,
  'both account-owned storage buckets are private'
);

select * from finish();
rollback;
```

- [ ] **Step 9: Run backend unit and database tests**

Run:

```powershell
npx jest --runInBand supabase/functions/delete-account/storage.test.ts supabase/functions/delete-account/handler.test.ts
npx supabase test db supabase/tests/account-deletion.sql
```

Expected: all Jest and pgTAP assertions PASS. If the installed Supabase CLI accepts only the directory-wide form, run `npx supabase test db` and confirm both `rls.sql` and `account-deletion.sql` pass.

- [ ] **Step 10: Commit the deletion backend**

```powershell
git add -- supabase/functions/delete-account/storage.ts supabase/functions/delete-account/storage.test.ts supabase/functions/delete-account/handler.ts supabase/functions/delete-account/handler.test.ts supabase/functions/delete-account/index.ts supabase/config.toml supabase/migrations/202608150001_account_deletion_privacy.sql supabase/tests/account-deletion.sql
git diff --cached --name-status
git commit -m "feat: delete accounts and owned data"
```

### Task 5: Add a Typed, Fail-Closed Account-Deletion Client

**Files:**

- Create: `src/features/account-deletion/api.ts`
- Create: `src/features/account-deletion/api.test.ts`

**Interfaces:**

- Consumes: authenticated Supabase access token and `EXPO_PUBLIC_SUPABASE_URL`.
- Produces: `deleteAccount(input): Promise<void>` and `AccountDeletionError` from the shared signatures.

- [ ] **Step 1: Write failing API client tests**

Create `api.test.ts` with injected fetchers. Assert the success request exactly:

```ts
expect(fetcher).toHaveBeenCalledWith(
  "https://project.example/functions/v1/delete-account",
  expect.objectContaining({
    method: "POST",
    headers: {
      Authorization: "Bearer access-token",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ confirmation: "DELETE" }),
  }),
);
```

Add tests for:

- missing base URL throws code `MISSING_CONFIGURATION` without calling fetch;
- network failure throws `NETWORK_ERROR`;
- 401 payload becomes `AccountDeletionError` with `UNAUTHORIZED`;
- 500 storage payload preserves `stage === "storage"` but exposes only the server’s safe `message`;
- invalid 200 JSON throws `INVALID_RESPONSE` rather than reporting success.

- [ ] **Step 2: Run the client test and observe failure**

Run:

```powershell
npx jest --runInBand src/features/account-deletion/api.test.ts
```

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement the request and response schemas**

Use Zod:

```ts
const successSchema = z.object({ deleted: z.literal(true) }).strict();
const errorSchema = z.object({
  message: z.string().min(1),
  code: z.string().min(1),
  stage: z.enum(["storage", "analytics", "auth_user"]).nullable().optional(),
}).strict();
```

Normalize `baseUrl` exactly as the analysis API does: accept either the project root or a URL already ending in `/functions/v1`. Send only `{ confirmation: "DELETE" }`. On a non-2xx response, parse the safe error shape and otherwise use `Account deletion failed` with `REQUEST_FAILED`. Resolve only when `successSchema` validates.

- [ ] **Step 4: Run the API tests**

Run:

```powershell
npx jest --runInBand src/features/account-deletion/api.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit the client boundary**

```powershell
git add -- src/features/account-deletion/api.ts src/features/account-deletion/api.test.ts
git diff --cached --name-status
git commit -m "feat: add account deletion client"
```

### Task 6: Add Safe Account-Deletion UX to Settings

**Files:**

- Modify: `src/screens/profile/index.tsx`
- Modify: `src/screens/profile/profile.test.tsx`

**Interfaces:**

- Consumes: `onDeleteAccount(): Promise<void>`, `onManageSubscription()`, and `hasManagedSubscription: boolean` from Task 7.
- Produces: a local confirmation state machine that requires exact `DELETE`, prevents duplicate requests, preserves retry on failure, and never treats subscription management as a deletion prerequisite.

- [ ] **Step 1: Replace the “no delete button” assertion and add complete UX tests**

In `profile.test.tsx`, change the first test to require a `Delete Account` button. Add tests covering:

```tsx
const onDeleteAccount = jest.fn().mockResolvedValue(undefined);
const onManageSubscription = jest.fn();
const screen = render(
  <ProfileScreen
    hasManagedSubscription
    onDeleteAccount={onDeleteAccount}
    onManageSubscription={onManageSubscription}
  />,
);

await fireEvent.press(screen.getByRole("button", { name: "Delete Account" }));
expect(screen.getByText(/does not cancel your Apple subscription/i)).toBeTruthy();
expect(screen.getByRole("button", { name: "Delete Account Now" }).props.accessibilityState.disabled).toBe(true);
await fireEvent.press(screen.getByRole("button", { name: "Manage Apple Subscription" }));
expect(onManageSubscription).toHaveBeenCalledTimes(1);
await fireEvent.changeText(screen.getByLabelText("Type DELETE to confirm"), "DELETE");
await fireEvent.press(screen.getByRole("button", { name: "Delete Account Now" }));
await waitFor(() => expect(onDeleteAccount).toHaveBeenCalledTimes(1));
```

Add separate tests for cancel, no-subscription copy, wrong-case confirmation, double press while pending, and a rejected deletion showing `Your account could not be deleted. No deletion was confirmed. Try again.` while preserving the dialog for retry.

- [ ] **Step 2: Run profile tests and observe failure**

Run:

```powershell
npx jest --runInBand src/screens/profile/profile.test.tsx
```

Expected: FAIL because account deletion is absent.

- [ ] **Step 3: Implement the presentation state machine**

Add props:

```ts
hasManagedSubscription?: boolean;
onDeleteAccount?: () => Promise<void>;
```

Add local state:

```ts
const [deleteModalVisible, setDeleteModalVisible] = useState(false);
const [deleteConfirmation, setDeleteConfirmation] = useState("");
const [deleteBusy, setDeleteBusy] = useState(false);
const [deleteError, setDeleteError] = useState<string | null>(null);
```

Render `Delete Account` as a separate destructive action below Log Out. The modal must enumerate account, videos, artifacts, analyses, coaching, profile, and linked app activity. When `hasManagedSubscription` is true, render both `Manage Apple Subscription` and `Delete Account Now`. When false, omit the management button but keep the immediate destructive action.

The submit handler must:

```ts
if (deleteConfirmation !== "DELETE" || deleteBusy || !onDeleteAccount) return;
setDeleteBusy(true);
setDeleteError(null);
try {
  await onDeleteAccount();
} catch {
  setDeleteError("Your account could not be deleted. No deletion was confirmed. Try again.");
} finally {
  setDeleteBusy(false);
}
```

Do not close the modal before the promise resolves. On success, route teardown will unmount the screen.

- [ ] **Step 4: Run profile tests and accessibility assertions**

Run:

```powershell
npx jest --runInBand src/screens/profile/profile.test.tsx
```

Expected: PASS; destructive and management actions have distinct accessible names.

- [ ] **Step 5: Commit the Settings deletion UI**

```powershell
git add -- src/screens/profile/index.tsx src/screens/profile/profile.test.tsx
git diff --cached --name-status
git commit -m "feat: add account deletion confirmation"
```

### Task 7: Orchestrate Server Deletion, Local Cleanup, and Signed-Out Confirmation

**Files:**

- Modify: `src/app/(tabs)/(profile)/index.tsx`
- Create: `src/features/account-deletion/profile-route.test.tsx`
- Modify: `src/app/(auth)/login.tsx`
- Modify: `src/screens/auth/auth-screens.test.tsx`

**Interfaces:**

- Consumes: `deleteAccount`, `auth.session.access_token`, `billing.logOut`, `onboarding.markLoggedOut`, `auth.logOut`, query cache clearing already performed by `AuthProvider`, and login `accountDeleted=1` support from Task 3.
- Produces: complete route orchestration and a truthful post-deletion signed-out state.

- [ ] **Step 1: Write the route orchestration test before modifying the route**

Create `profile-route.test.tsx` using the mock style in `manage-subscription-route.test.tsx`. Capture `ProfileScreen` props and assert:

```ts
await (capturedProps.onDeleteAccount as () => Promise<void>)();
expect(mockDeleteAccount).toHaveBeenCalledWith({ accessToken: "access-token" });
expect(mockBillingLogOut).toHaveBeenCalledTimes(1);
expect(mockMarkLoggedOut).toHaveBeenCalledTimes(1);
expect(mockAuthLogOut).toHaveBeenCalledWith("user");
expect(mockReplace).toHaveBeenCalledWith("/login?accountDeleted=1");
```

Record call order and require server deletion before any local logout. Add failures:

- no access token rejects before `deleteAccount` and keeps the route signed in;
- server rejection calls none of the three cleanup functions and does not navigate;
- RevenueCat logout rejection still performs onboarding/auth cleanup and navigation after confirmed server deletion;
- `hasManagedSubscription` is true for `app_store`/`active_renewing` and `app_store`/`active_cancelled`, false for `store: null` and `not_subscribed`.

- [ ] **Step 2: Run the route test and observe failure**

Run:

```powershell
npx jest --runInBand src/features/account-deletion/profile-route.test.tsx
```

Expected: FAIL because the profile route has no deletion callback.

- [ ] **Step 3: Implement the deletion orchestration**

In `src/app/(tabs)/(profile)/index.tsx`, import `deleteAccount` and calculate:

```ts
const hasManagedSubscription = Boolean(access.access.store)
  && access.access.lifecycleState !== "not_subscribed"
  && access.access.lifecycleState !== "expired"
  && access.access.lifecycleState !== "unknown";
```

Pass `hasManagedSubscription` and:

```tsx
onDeleteAccount={async () => {
  const accessToken = auth.session?.access_token;
  if (!accessToken) throw new Error("Sign in again before deleting your account.");

  await deleteAccount({ accessToken });

  await billing.logOut().catch(() => undefined);
  await onboarding.markLoggedOut();
  await auth.logOut("user");
  router.replace("/login?accountDeleted=1" as Href);
}}
```

The auth provider already clears React Query in `clearLocalSession()`. Do not add a second query client or clear device-wide capture preferences.

- [ ] **Step 4: Verify success notice and route cleanup together**

Run:

```powershell
npx jest --runInBand src/features/account-deletion/profile-route.test.tsx src/screens/profile/profile.test.tsx src/screens/auth/auth-screens.test.tsx src/features/auth/auth-provider.test.tsx
```

Expected: PASS; success navigates to a signed-out confirmation, while server failure preserves the current session.

- [ ] **Step 5: Commit the client orchestration**

```powershell
git add -- ':(literal)src/app/(tabs)/(profile)/index.tsx' src/features/account-deletion/profile-route.test.tsx ':(literal)src/app/(auth)/login.tsx' src/screens/auth/auth-screens.test.tsx
git diff --cached --name-status
git commit -m "feat: complete account deletion lifecycle"
```

### Task 8: Publish Final Terms, Privacy, Retention, and Privacy-Choices Content

**Files:**

- Modify: `website/app/terms/page.tsx`
- Modify: `website/app/terms/page.test.tsx`
- Modify: `website/app/privacy/page.tsx`
- Modify: `website/app/privacy/page.test.tsx`
- Modify: `website/app/retention/page.tsx`
- Create: `website/app/retention/page.test.tsx`
- Create: `website/app/privacy-choices/page.tsx`
- Create: `website/app/privacy-choices/page.test.tsx`
- Modify: `website/components/site-shell.tsx`
- Create: `website/components/site-shell.test.tsx`

**Interfaces:**

- Consumes: implemented subscription/account-deletion behavior from Tasks 2–7 and current processor boundaries.
- Produces: final production pages at `/terms`, `/privacy`, `/retention`, and `/privacy-choices`, plus a discoverable footer link.

- [ ] **Step 1: Write semantic policy tests before changing policy copy**

Extend the Terms test to require:

```ts
assert.doesNotMatch(html, /\bdraft\b|finalized before public release/i);
assert.match(html, /automatically renews each month until cancelled/i);
assert.match(html, /charged to (?:your )?Apple ID/i);
assert.match(html, /does not cancel (?:your )?Apple subscription/i);
assert.match(html, /https:\/\/www\.apple\.com\/legal\/internet-services\/itunes\/dev\/stdeula\//);
```

Extend the Privacy test to require these subjects without binding to paragraph layout:

```ts
for (const subject of [
  /photos? or videos?|exercise recordings/i,
  /body|head|hand|motion/i,
  /Google Gemini/i,
  /purchase|entitlement/i,
  /product interaction|analytics/i,
  /diagnostic/i,
  /delete (?:your )?account/i,
  /RevenueCat/i,
  /Supabase/i,
]) assert.match(html, subject);
```

Create Retention tests requiring permanent in-app account deletion, individual-analysis deletion, processor/legal retention limits, and the statement that Apple billing is not cancelled by deletion.

Create Privacy Choices tests requiring:

- `Settings > Delete Account`;
- immediate deletion despite an active subscription;
- analysis deletion;
- Apple subscription management;
- Sign in with Apple authorization management;
- `/retention` and `/support` links.

Create `site-shell.test.tsx` and assert the footer contains `href="/privacy-choices"` with label `Privacy Choices`.

- [ ] **Step 2: Run website tests and verify failures**

Run:

```powershell
npm test
```

Working directory: `website`

Expected: FAIL because Terms remain marked as draft, Privacy lacks complete disclosures, and Privacy Choices does not exist.

- [ ] **Step 3: Finalize Terms of Use**

Update `terms/page.tsx` to `updated="August 15, 2026"`. Remove the first draft sentence. Keep the exercise/AI safety limitation and add these production facts:

- Formie Pro is a monthly auto-renewable subscription with the localized price shown before purchase.
- Payment is charged to the Apple ID; renewal continues unless cancelled at least 24 hours before the current period ends.
- Users manage/cancel in Apple subscription settings; deleting Formie does not cancel Apple billing.
- Restore Purchases is available in the app.
- Ten analyses are included per monthly quota period; unused analyses do not roll over.
- Account deletion removes Formie-controlled user content subject to limited processor/legal retention described by Privacy/Retention.
- Apple’s standard EULA applies, linked at `https://www.apple.com/legal/internet-services/itunes/dev/stdeula/`.

Do not state an annual plan is purchasable. Preserve the truthful note that existing provider-managed annual access, if present, remains honored.

- [ ] **Step 4: Complete the Privacy Policy disclosure map**

Update `privacy/page.tsx` to `updated="August 15, 2026"` and organize content under these headings:

1. **Information Formie handles:** name/email/user ID, profile and fitness inputs, purchases/entitlements, recordings and support content, results/coaching, product interaction, and diagnostics.
2. **Video and body-derived analysis:** recordings may contain the user’s body, head, hands, equipment, surroundings, and motion; Formie derives exercise/form evidence to produce coaching.
3. **Purposes:** account operation, requested analysis, subscription access, security, support, diagnostics, and product improvement.
4. **Service providers:** Supabase for auth/database/storage/functions, Google Gemini for requested video/AI analysis, RevenueCat and Apple for subscription state, Vercel for website hosting, and Resend for feedback/support messages the user submits.
5. **Linkage and tracking:** account, purchase, content, support, and product-interaction data may be linked to the Formie user ID; Formie does not use this data for cross-company advertising tracking.
6. **Retention and deletion:** link `/retention` and `/privacy-choices`; state the in-app deletion path and individual-analysis controls.
7. **Limits:** Apple/RevenueCat/payment, security, fraud, backup, support, and legal records may follow separate required schedules; deleting Formie does not cancel billing or automatically remove Apple authorization.
8. **Contact:** retain the current support email and link `/support`.

Use provider names only where the deployment actually uses them. Do not claim encryption at rest or end-to-end encryption unless separately proven; retain the verified encryption-in-transit statement.

- [ ] **Step 5: Align Retention with implemented deletion**

Update `retention/page.tsx` to `updated="August 15, 2026"`. Replace “request account deletion” as the main path with `Settings > Delete Account`. Explain that successful deletion removes both private Storage buckets and account-owned database data, while local Photos/Files/backups and external payment/authorization records require their own controls. Keep the optional 30-day analysis-cleanup distinction and link to `/privacy-choices`.

- [ ] **Step 6: Create the Privacy Choices page and footer link**

Create `privacy-choices/page.tsx` with:

```tsx
export const metadata: Metadata = {
  title: "Privacy Choices",
  alternates: { canonical: "/privacy-choices" },
};
```

Use `LegalPage` and sections titled `Delete your Formie account`, `Delete an analysis`, `Manage Apple billing`, `Manage Sign in with Apple`, and `Ask for help`. State exact app navigation and link `/retention`, `/privacy`, and `/support`. Link Apple’s account-management destination using an ordinary external anchor and do not imply Formie controls Apple’s retention.

Add `<Link href="/privacy-choices">Privacy Choices</Link>` to the footer adjacent to Privacy/Retention.

- [ ] **Step 7: Run complete website verification**

Run from `website`:

```powershell
npm test
npx tsc --noEmit
npm run lint
npm run build
```

Expected: all Node tests, TypeScript, ESLint, and Next production build PASS; build output includes `/privacy-choices`.

- [ ] **Step 8: Commit only website policy changes**

```powershell
git add -- website/app/terms/page.tsx website/app/terms/page.test.tsx website/app/privacy/page.tsx website/app/privacy/page.test.tsx website/app/retention/page.tsx website/app/retention/page.test.tsx website/app/privacy-choices/page.tsx website/app/privacy-choices/page.test.tsx website/components/site-shell.tsx website/components/site-shell.test.tsx
git diff --cached --name-status
git commit -m "fix: publish complete privacy and subscription policies"
```

### Task 9: Prove a Clean Release Candidate and Reconcile App Store Screenshots

**Files:**

- Inspect: all tracked source included in Tasks 1–8
- Conditionally modify only after reproduced clean-checkout failure: `package.json`, `package-lock.json`
- Inspect without automatically committing: `jest.config.js`
- Modify if the shipped UI no longer matches: `assets/app-store/ios/6.7/01-coaching.png`, `02-process.png`, `03-subscription.png`
- Create at execution time: clean Git worktree `C:\Users\yuanc\OneDrive\Documents\Formai-release-app-store-hardening`

**Interfaces:**

- Consumes: committed implementation from Tasks 1–8 and the existing dirty-tree inventory.
- Produces: a clean commit SHA whose dependency install, tests, exports, and screenshots correspond to the source EAS will build.

- [ ] **Step 1: Run focused release suites in the working tree**

Run:

```powershell
npx jest --runInBand src/screens/onboarding/approved-onboarding.test.tsx src/screens/auth/auth-screens.test.tsx src/screens/profile/profile.test.tsx src/features/auth/onboarding-auth-route.test.tsx src/features/billing/subscription-route.test.tsx src/features/account-deletion/api.test.ts src/features/account-deletion/profile-route.test.tsx supabase/functions/delete-account/storage.test.ts supabase/functions/delete-account/handler.test.ts
node --test scripts/store-metadata.test.cjs
```

Expected: both the focused Jest suites and the Node metadata suite PASS.

- [ ] **Step 2: Run full mobile static and bundle verification**

Run:

```powershell
npm test -- --runInBand
npm run typecheck
npm run lint
npx expo export --platform ios --output-dir .expo/review/ios
```

Expected: all tests, TypeScript, lint, and iOS export PASS. Export output must not contain unresolved environment-variable errors.

- [ ] **Step 3: Inspect current dependency-only changes without assuming they belong to the release**

Run:

```powershell
git diff -- package.json package-lock.json jest.config.js
npm ls react react-native expo expo-three
```

Expected: dependency graph is valid. The existing `expo-three` override is not included merely because the dirty working tree passes.

- [ ] **Step 4: Create a clean candidate worktree from the committed branch**

At execution time, first read and apply `superpowers:using-git-worktrees`. Then run a path-safe creation from the repository root:

```powershell
$candidatePath = 'C:\Users\yuanc\OneDrive\Documents\Formai-release-app-store-hardening'
if (Test-Path -LiteralPath $candidatePath) { throw "Candidate path already exists: $candidatePath" }
git worktree add --detach $candidatePath HEAD
if ($LASTEXITCODE -ne 0) { throw 'Candidate worktree creation failed' }
git -C $candidatePath status --short
```

Expected: candidate worktree is clean.

- [ ] **Step 5: Install and verify from the committed lockfile**

Run in the candidate worktree:

```powershell
npm ci
npm test -- --runInBand
npm run typecheck
npm run lint
npx expo export --platform ios --output-dir .expo/review/ios
node --test scripts/store-metadata.test.cjs
```

Expected: PASS from the committed tree. If `npm ci`, TypeScript, Jest, or export fails specifically because `expo-three` resolves React 17, return to the main worktree, stage only the existing `package.json` override and matching lockfile removal, rerun this step from a newly created clean candidate, and commit:

```powershell
git add -- package.json package-lock.json
git diff --cached --name-status
git commit -m "fix: align expo-three React dependency"
```

Do not include `jest.config.js` unless a clean candidate test reproduces an ignore-path failure that the exact `.codex-tmp` entries fix.

- [ ] **Step 6: Visually verify all App Store screenshots against the candidate**

Open each PNG at original detail and compare it with the corresponding candidate screen. Verify:

- the screenshots describe features that exist in the candidate;
- no screenshot shows Google/email authentication;
- subscription imagery does not display a price or terms inconsistent with the live StoreKit offer;
- no development controls, test accounts, personal data, debug overlays, or simulator chrome are visible;
- text is legible and not clipped at `1290x2796`.

If `03-subscription.png` contains the old raster-only paywall, capture a fresh image from the production candidate showing the native localized-price area, renewal disclosure, Restore Purchases, Terms, and Privacy. Preserve `01-coaching.png` and `02-process.png` when they remain accurate.

- [ ] **Step 7: Run a tracked-secret and unfinished-copy scan**

Run from the candidate worktree:

```powershell
rg -n "service_role|SUPABASE_SERVICE_ROLE_KEY|BEGIN PRIVATE KEY|api[_-]?key\s*[:=]|lorem ipsum|finalized before public release|\bdraft\b|Coming soon" . -g '!node_modules' -g '!.git' -g '!.expo' -g '!website/.next'
```

Expected: no committed secret values; no release-facing draft/unfinished authentication copy. Expected configuration variable names in server code are reviewed manually and are not treated as leaked values.

- [ ] **Step 8: Record the candidate SHA and clean status**

Run:

```powershell
git -C 'C:\Users\yuanc\OneDrive\Documents\Formai-release-app-store-hardening' rev-parse HEAD
git -C 'C:\Users\yuanc\OneDrive\Documents\Formai-release-app-store-hardening' status --short
```

Expected: one identified SHA and empty status. This SHA is the only source authorized for the EAS production build in Task 11.

### Task 10: Deploy and Prove the Production Backend and Website

**Files:**

- Deploy from committed files: `supabase/migrations/202608150001_account_deletion_privacy.sql`
- Deploy from committed files: `supabase/functions/delete-account/*`
- Deploy from committed directory: `website/`
- External project: Supabase ref `jnprpjnnjyrhvfeflpju`
- External project: Vercel project `useformie` (`prj_GacDtDkPonJgLyheX4HDbI525pKa`)

**Interfaces:**

- Consumes: clean verified candidate from Task 9.
- Produces: live backend deletion endpoint and live legal pages used by the candidate and App Store metadata.

- [ ] **Step 1: Reconfirm linked deployment targets without printing secrets**

Run:

```powershell
Get-Content supabase/.temp/project-ref
Get-Content website/.vercel/project.json
npx supabase migration list --linked
```

Expected: Supabase project ref is exactly `jnprpjnnjyrhvfeflpju`; Vercel project name is exactly `useformie`. Stop if either differs.

- [ ] **Step 2: Push the database migration and verify remote parity**

Run:

```powershell
npx supabase db push --linked
npx supabase migration list --linked
```

Expected: `202608150001` is present locally and remotely. A migration failure blocks function deployment and iOS build.

- [ ] **Step 3: Deploy only the new Edge Function**

Run:

```powershell
npx supabase functions deploy delete-account --project-ref jnprpjnnjyrhvfeflpju
npx supabase functions list --project-ref jnprpjnnjyrhvfeflpju
```

Expected: `delete-account` is listed as active with JWT verification enabled by repository config.

- [ ] **Step 4: Prove unauthenticated rejection**

Run:

```powershell
try {
  Invoke-WebRequest -Method Post -Uri 'https://jnprpjnnjyrhvfeflpju.supabase.co/functions/v1/delete-account' -ContentType 'application/json' -Body '{"confirmation":"DELETE"}' -ErrorAction Stop
  throw 'Unauthenticated deletion unexpectedly succeeded'
} catch {
  $status = [int]$_.Exception.Response.StatusCode
  if ($status -ne 401) { throw "Expected 401, received $status" }
}
```

Expected: 401; no personal data or token is printed.

- [ ] **Step 5: Exercise authenticated deletion using a disposable account**

Create a dedicated Formie test account through the production app, upload one non-sensitive test recording, and record its user ID privately for verification without putting it in logs or commits. Through the authenticated Supabase dashboard, place a harmless `{"deletionProof":true}` JSON object at that user’s `analysis-artifacts/<user-id>/deletion-proof.json` path so both bucket-removal branches are exercised. Confirm rows exist for that account and objects exist under the exact user prefix in both buckets. Execute deletion in the app, then verify with admin tooling:

- Auth user is absent;
- user profile, sessions, results, coaching, entitlements, reservations, feedback, onboarding attribution, and analytics are absent;
- no object remains under that user prefix in either private bucket;
- a second unrelated test user and shared exercise catalog remain present;
- the app reaches the signed-out deletion notice;
- Apple subscription/authorization guidance is shown without claiming automatic cancellation/revocation.

Do not use the owner’s production account. Redact IDs and emails from execution notes.

- [ ] **Step 6: Deploy the verified website**

Run from `website` in the clean candidate:

```powershell
npx vercel --prod --yes
```

Expected: Vercel reports the linked `useformie` production deployment and `https://useformie.com` alias.

- [ ] **Step 7: Verify every live review URL and final copy**

Run:

```powershell
$urls = @(
  'https://useformie.com/terms',
  'https://useformie.com/privacy',
  'https://useformie.com/retention',
  'https://useformie.com/privacy-choices',
  'https://useformie.com/support'
)
foreach ($url in $urls) {
  $response = Invoke-WebRequest -UseBasicParsing -Uri $url
  if ($response.StatusCode -ne 200) { throw "$url returned $($response.StatusCode)" }
  if ($response.Content -match '\bdraft\b|finalized before public release') { throw "$url contains release-blocking copy" }
  "$url $($response.StatusCode)"
}
```

Expected: five 200 responses and no draft/pre-release markers. Manually verify Privacy Choices contains the in-app path and Apple billing/authorization limits.

### Task 11: Build, Upload, and Physically Verify the Replacement iOS Candidate

**Files:**

- Build configuration: `app.json`
- Build/submit configuration: `eas.json`
- Source: exact clean candidate SHA recorded in Task 9
- External EAS project: `d05da588-4c59-4d3c-963d-a6d2b940fea1`
- External App Store Connect app: `6796542864`

**Interfaces:**

- Consumes: verified production backend/site and clean source SHA.
- Produces: one identified EAS production build uploaded to App Store Connect/TestFlight, plus device-level acceptance evidence.

- [ ] **Step 1: Reconfirm source, EAS identity, and version policy**

Run from the clean candidate:

```powershell
git status --short
git rev-parse HEAD
npx eas-cli@latest whoami
npx eas-cli@latest project:info
npx eas-cli@latest build:version:get -p ios --profile production
```

Expected: clean tree; project ID `d05da588-4c59-4d3c-963d-a6d2b940fea1`; remote version source; next build number greater than rejected build 54 because `autoIncrement` is enabled.

- [ ] **Step 2: Start the production iOS build from the candidate SHA**

Run:

```powershell
npx eas-cli@latest build -p ios --profile production --non-interactive --wait
```

Expected: EAS build completes successfully. Record build ID, build number, artifact URL, and source commit SHA from EAS output. A failed build returns to source diagnosis; do not submit an older build.

- [ ] **Step 3: Validate EAS build metadata against the authorized SHA**

Run:

```powershell
$builds = npx eas-cli@latest build:list --platform ios --limit 1 --json --non-interactive | ConvertFrom-Json
$buildId = $builds[0].id
if ([string]::IsNullOrWhiteSpace($buildId)) { throw 'No iOS build ID returned' }
$build = npx eas-cli@latest build:view $buildId --json | ConvertFrom-Json
$expectedSha = git rev-parse HEAD
if ($build.gitCommitHash -ne $expectedSha) { throw "Build SHA $($build.gitCommitHash) does not match $expectedSha" }
$build | Select-Object id,status,platform,appVersion,buildNumber,gitCommitHash
```

Expected: status `FINISHED`, platform `IOS`, version `1.0`, build number greater than 54, exact SHA match.

- [ ] **Step 4: Upload this exact build to App Store Connect/TestFlight**

Run:

```powershell
npx eas-cli@latest submit -p ios --profile production --id $buildId --non-interactive --wait
npx eas-cli@latest submit:list -p ios --limit 5
```

Expected: EAS submission finishes and App Store Connect begins processing this build. This is a binary upload, not App Store Review submission.

- [ ] **Step 5: Run physical-device acceptance on the uploaded build**

Install the exact build through TestFlight or an authorized internal distribution path and test on a physical iPhone:

1. Fresh install and Apple sign-in.
2. Onboarding legal consent links open production Terms and Privacy.
3. Premium screen shows the actual localized Store price and monthly period.
4. Purchase sheet opens; cancellation returns safely without granting access.
5. Restore Purchases reports no purchase, restored access, and transient failure accurately using suitable sandbox accounts.
6. Terms and Privacy remain reachable on the paywall.
7. Camera/microphone prompts match their usage and recording works.
8. A short recording uploads, completes analysis, and opens its result.
9. Subscription management opens Apple’s authoritative screen.
10. Delete Account warns about Apple billing, permits immediate deletion, removes the disposable account, and shows the signed-out confirmation.
11. Relaunch does not recreate or reopen the deleted account.

Record pass/fail per item, device model, iOS version, build number, and timestamp. Do not report StoreKit purchase/restore/deletion proof for a branch or simulator that is not the uploaded build.

- [ ] **Step 6: Gate the App Store candidate**

Expected: every applicable physical-device item passes. A provider outage or unavailable sandbox account is recorded as unproven and blocks the corresponding external claim; it does not get converted into a source-code pass.

### Task 12: Reconcile App Store Connect and Submit the New Build for Review

**Files:**

- Source baseline: `store.config.json`
- Source validation: `scripts/store-metadata.test.cjs`
- External: App Store Connect listing, App Privacy, User Privacy Choices URL, review information, subscription, screenshots, build selection, and review submission

**Interfaces:**

- Consumes: live website/backend, exact uploaded build, device acceptance evidence, and source-controlled listing/review notes.
- Produces: a fresh App Store Review submission whose live status is independently verified.

- [ ] **Step 1: Read fresh App Store Connect state before editing**

In the signed-in App Store Connect session, verify and record without changing:

- Formie app ID `6796542864`;
- current version status, expected to be editable after Developer Rejected;
- processed build list and the exact new build number from Task 11;
- current description, privacy/support URLs, screenshots, review contact fields, review notes, App Privacy publication timestamp, license agreement, subscription group, and Formie Monthly product state.

Stop if another build/version is already In Review or if external state differs materially from the expected editable version.

- [ ] **Step 2: Reconcile listing and review information**

Update live fields to match `store.config.json`:

- description includes the exact standard EULA URL;
- Privacy URL is `https://useformie.com/privacy`;
- Support URL is `https://useformie.com/support`;
- Marketing URL is `https://useformie.com`;
- User Privacy Choices URL is `https://useformie.com/privacy-choices`;
- review notes use the exact tested flow from Task 1;
- screenshots are the visually approved `1290x2796` set from Task 9;
- review first/last name, email, and phone remain verified real values.
- the App Review sign-in-required control is enabled because core functionality requires an account; notes explain that Apple sign-in is the only method and no separate password exists.

If a required contact field is empty, stop for the owner’s real contact information. Do not use repository author data or inferred phone numbers.

- [ ] **Step 3: Reconcile App Privacy against shipped behavior**

For each currently declared type, compare collection, linkage, purpose, and tracking answers with the candidate and policy:

| Product behavior | App Privacy category to verify |
| --- | --- |
| Email, display name | Contact Info |
| User ID and Apple/Supabase account association | Identifiers |
| Apple/RevenueCat product and entitlement state | Purchases |
| Exercise recordings, feedback, coaching messages | User Content, Photos or Videos, Customer Support |
| Height, weight, gender, exercise declarations, fitness usage | Health and Fitness categories actually defined by Apple |
| Derived head, hand, body-position, and motion evidence | Body-related categories currently declared |
| Paywall, onboarding, and feature events | Product Interaction |
| App version, build, platform, OS, and error context | Diagnostics categories actually collected |

Confirm tracking is `No` unless the implementation shares data for cross-company advertising/tracking. Do not remove broad body categories solely to make the label smaller; remove or add a type only after tracing actual collection and provider transmission.

- [ ] **Step 4: Reconfirm subscription metadata and review attachment**

Verify Formie Monthly has its display name, duration, price, localization, review screenshot, and the standard EULA/listing reference required for the submitted version. Add both the app version and Formie Monthly subscription to the same review submission if App Store Connect requires separate selectable items.

- [ ] **Step 5: Select only the authorized replacement build**

Choose the exact build number and SHA proven in Task 11. Do not reuse build 54. Save the version page and confirm the displayed build number before advancing.

- [ ] **Step 6: Run the final pre-submission evidence checklist**

Require all of these to be true:

- local candidate worktree was clean at the recorded SHA;
- full mobile/backend/website verification passed;
- Supabase migration/function are live and production deletion was exercised with a disposable account;
- all five production legal/support URLs return 200;
- uploaded build matches the SHA and passed device acceptance;
- description includes the standard EULA;
- User Privacy Choices URL is live;
- App Privacy matches actual collection;
- review contacts/notes are complete;
- new build and subscription are attached;
- no unresolved App Store Connect warning or missing export-compliance response remains.

- [ ] **Step 7: Submit and prove the status transition**

Click `Add for Review` for every required item, inspect the assembled review submission, then click `Submit for Review`. Reload App Store Connect and verify the new live status is `Waiting for Review` or `In Review` with the replacement build selected.

Do not report submission from the click alone. Evidence is the fresh post-submit status and attached build number.

- [ ] **Step 8: Report completion with explicit evidence boundaries**

Report:

- fixed source behavior and commits;
- local test/export results;
- deployed Supabase migration/function and website URLs;
- production disposable-account deletion result;
- EAS build ID, version/build number, and source SHA;
- physical-device results, including any unproven StoreKit boundary;
- live App Store status and submission timestamp;
- remaining external uncertainty: Apple’s review decision.

## Execution Checkpoints

- **Checkpoint A — after Task 3:** review native paywall/auth screenshots and focused tests.
- **Checkpoint B — after Task 7:** review backend deletion order, privacy isolation, and full in-app deletion UX before any deployment.
- **Checkpoint C — after Task 9:** approve the clean SHA and screenshots before paid EAS build resources are used.
- **Checkpoint D — after Task 11:** approve physical-device evidence before App Store Connect submission.

## Definition of Done

The work is complete only when the replacement build is attached to a fresh App Store Review submission and the live status is verified as `Waiting for Review` or `In Review`. Source implementation alone is not completion. Apple acceptance remains outside the implementation’s control and must not be claimed until App Store Connect later reports approval.
