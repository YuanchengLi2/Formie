# Internal TestFlight Home Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Subagents are prohibited by this repository's `AGENTS.md`.

**Goal:** Repair the compact-iPhone home layout and distribute the corrected production app to the account holder through internal TestFlight.

**Architecture:** Keep the existing home-screen component and production artwork. Make all first-load states use iOS automatic content insets, size the empty-state hero from the artwork aspect ratio, and remove the redundant React Native CTA overlay. Release through the existing EAS project using a production App Store build followed by App Store Connect internal testing.

**Tech Stack:** Expo SDK 54, Expo Router, React Native, React Native Testing Library, Jest, EAS Build, App Store Connect, TestFlight.

## Global Constraints

- Preserve the existing FORM visual system and `assets/production/home-record-card.png`.
- Use bundle identifier `app.form.coach`.
- Use internal TestFlight only; do not create an external testing group or submit for Beta App Review.
- The TestFlight build must run without Metro, Developer Mode, or a development-client URL.
- Do not implement 3D tracking or change the coaching pipeline in this release.
- Do not stage or commit generated QR PNG files.

---

### Task 1: Repair the First-Recording Home Layout

**Files:**
- Modify: `src/screens/home/home.test.tsx`
- Modify: `src/screens/home/index.tsx`

**Interfaces:**
- Consumes: `HomeScreen(props: HomeScreenProps)` and the existing `recordCard` production image.
- Produces: a safe-area-aware empty/loading home state and one accessible `Record an Exercise` hero pressable with aspect ratio `813 / 605`.

- [ ] **Step 1: Write the failing layout regression test**

Add this test to `src/screens/home/home.test.tsx`:

```tsx
it("keeps the first-recording hero inside the safe area with one responsive CTA", async () => {
  const screen = await render(<HomeScreen onRecord={jest.fn()} historyResolved />);

  expect(screen.getByLabelText("First recording hero").props.contentInsetAdjustmentBehavior).toBe("automatic");
  expect(screen.getByTestId("home-record-card")).toHaveStyle({ aspectRatio: 813 / 605 });
  expect(screen.queryByText("Record your first set")).toBeNull();
  expect(screen.getByLabelText("Record an Exercise")).toBeTruthy();
});

it("keeps the loading header inside the safe area", async () => {
  const screen = await render(<HomeScreen onRecord={jest.fn()} historyResolved={false} />);
  expect(screen.getByLabelText("Loading recording history").props.contentInsetAdjustmentBehavior).toBe("automatic");
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```powershell
npm test -- src/screens/home/home.test.tsx --runInBand
```

Expected: FAIL because the empty and loading containers do not expose `contentInsetAdjustmentBehavior="automatic"`, `home-record-card` does not exist, and the second CTA is still rendered.

- [ ] **Step 3: Implement the minimal responsive layout fix**

In `src/screens/home/index.tsx`:

1. Replace the loading root `View` with a `ScrollView` that has `contentInsetAdjustmentBehavior="automatic"`, preserves `accessibilityLabel="Loading recording history"`, uses `style={{ flex: 1, backgroundColor: colors.background }}`, and moves the existing gap/padding/flex rules into a `contentContainerStyle` with `flexGrow: 1`.
2. Add `contentInsetAdjustmentBehavior="automatic"` to the first-recording `ScrollView`.
3. Change the empty-state hero pressable from fixed `height: 390` to `aspectRatio: 813 / 605` and add `testID="home-record-card"`.
4. Delete the absolute-positioned CTA `View` and its `Record your first set` text. Keep `accessibilityRole="button"` and `accessibilityLabel="Record an Exercise"` on the full hero pressable.

The resulting hero must have this shape:

```tsx
<Pressable
  testID="home-record-card"
  accessibilityRole="button"
  accessibilityLabel="Record an Exercise"
  onPress={onRecord}
  style={({ pressed }) => ({
    aspectRatio: 813 / 605,
    overflow: "hidden",
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    opacity: pressed ? 0.78 : 1,
  })}
>
  <Image
    accessibilityLabel="Person squatting inside the FORM camera frame"
    source={recordCard}
    contentFit="cover"
    style={{ width: "100%", height: "100%" }}
  />
</Pressable>
```

- [ ] **Step 4: Run the focused test and verify GREEN**

Run:

```powershell
npm test -- src/screens/home/home.test.tsx --runInBand
```

Expected: all `HomeScreen` tests PASS with zero failures.

- [ ] **Step 5: Commit the isolated UI fix**

```powershell
git add -- src/screens/home/index.tsx src/screens/home/home.test.tsx
git commit -m "fix: repair compact iPhone home layout"
```

---

### Task 2: Verify the Release Candidate and Commit EAS Configuration

**Files:**
- Verify: `src/screens/home/index.tsx`
- Modify/commit existing setup: `app.json`
- Modify/commit existing setup: `package.json`
- Modify/commit existing setup: `package-lock.json`
- Create/commit existing setup: `eas.json`
- Generate but do not commit: `dist-testflight-home-check/`

**Interfaces:**
- Consumes: the corrected `HomeScreen`, Expo configuration, and EAS project ID `d05da588-4c59-4d3c-963d-a6d2b940fea1`.
- Produces: a locally verified iOS production bundle and committed release configuration.

- [ ] **Step 1: Run TypeScript and Expo project validation**

```powershell
npm run typecheck
npx expo-doctor
```

Expected: TypeScript exits `0`; Expo Doctor reports `18/18 checks passed`.

- [ ] **Step 2: Run the release-relevant Jest suite**

```powershell
npm test -- --runInBand src/screens/home/home.test.tsx src/screens/recording-tips/recording-tips.test.tsx src/screens/results/results.test.tsx src/screens/profile/profile.test.tsx
```

Expected: all selected suites and tests PASS with zero failures.

- [ ] **Step 3: Export the iOS JavaScript bundle**

```powershell
npx expo export --platform ios --output-dir dist-testflight-home-check
```

Expected: Expo completes an iOS export without Metro resolution or bundling errors.

- [ ] **Step 4: Commit only the EAS/native-container setup**

```powershell
git add -- app.json package.json package-lock.json eas.json
git diff --cached --check
git commit -m "build: configure EAS development and store releases"
```

Expected: the commit contains `expo-dev-client`, the EAS project link, encryption declaration, and development/production profiles. Generated QR PNGs and `dist-testflight-home-check/` remain untracked.

---

### Task 3: Create the Production App Store Build

**Files:**
- Read: `app.json`
- Read: `eas.json`
- External output: EAS iOS production build

**Interfaces:**
- Consumes: EAS project `@yuancheng/form-ai-coach`, production profile, bundle ID `app.form.coach`, and Apple team `68V49ZYC3A`.
- Produces: an App Store-signed production IPA and EAS build identifier.

- [ ] **Step 1: Start the non-interactive production build**

```powershell
npx eas-cli@latest build -p ios --profile production --non-interactive --no-wait
```

Expected: EAS reuses the remote Apple distribution certificate, auto-increments the build number, uploads the source archive, and prints a build URL. If App Store credentials require first-time interactive creation, rerun without `--non-interactive` in a visible PowerShell window and generate the requested App Store provisioning profile.

- [ ] **Step 2: Monitor the build to a terminal state**

```powershell
$raw = npx eas-cli@latest build:list -p ios --profile production --limit 1 --json --non-interactive 2>$null | Out-String
$latest = ($raw | ConvertFrom-Json)[0]
npx eas-cli@latest build:view $latest.id --json
```

Expected: `status` becomes `FINISHED` and `artifacts.applicationArchiveUrl` or `artifacts.buildUrl` is non-empty. If status is `ERRORED`, read the named failing build phase before making changes.

---

### Task 4: Upload to App Store Connect and Enable Internal TestFlight

**Files:**
- Read: `eas.json`
- External output: App Store Connect application record, uploaded build, and internal tester access

**Interfaces:**
- Consumes: the finished production IPA, Apple team `68V49ZYC3A`, bundle ID `app.form.coach`, and the account holder's Apple Account.
- Produces: an internally available TestFlight build of FORM AI Coach.

- [ ] **Step 1: Ensure the App Store Connect application record exists**

In App Store Connect, create the record if EAS reports `No suitable application records found`:

```text
Name: FORM AI Coach
Primary language: English (U.S.)
Bundle ID: app.form.coach
SKU: form-ai-coach-ios-1
User access: Full Access
```

- [ ] **Step 2: Submit the finished production build**

```powershell
npx eas-cli@latest submit -p ios --latest
```

Expected: authenticate with the Apple Account when prompted, select the `FORM AI Coach` App Store Connect record, and receive an EAS submission ID.

- [ ] **Step 3: Monitor upload and Apple processing**

```powershell
npx eas-cli@latest submit:list -p ios --limit 5
```

Expected: EAS submission status is `FINISHED`. Then wait for App Store Connect to finish processing the build under the TestFlight tab.

- [ ] **Step 4: Add internal access**

In App Store Connect:

1. Open `FORM AI Coach` and select `TestFlight`.
2. Create an internal group named `FORM Internal` with automatic distribution enabled.
3. Add the processed build.
4. Add the account holder as the internal tester.

Expected: TestFlight on the registered iPhone displays FORM AI Coach with an Install button. Launching this build must not request Developer Mode or a Metro URL.
