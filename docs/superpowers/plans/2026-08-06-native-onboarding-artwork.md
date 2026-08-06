# Native Onboarding Artwork Implementation Plan

> **For agentic workers:** Execute inline in the current worktree. Repository instructions explicitly prohibit subagents.

**Goal:** Rebuild Formie marketing onboarding and premium screens with native text and controls around pixel-identical approved artwork cutouts.

**Architecture:** A deterministic extraction script creates illustration-only transparent PNG assets from the approved raster sources. React Native screen components render native copy and controls separately, using responsive illustration containers without any screenshot frame. The premium component composes exact decorative cutouts around a native live-price card.

**Tech Stack:** Expo Router, React Native, expo-image, Pillow, Jest, Testing Library React Native.

---

### Task 1: Lock the native-layer contract with tests

**Files:**
- Modify `src/screens/onboarding/approved-onboarding.test.tsx`

- [ ] Require each marketing screen to render its approved illustration-only asset and native title/subtitle.
- [ ] Require the old `approved-artwork-*` screenshot identifiers to be absent.
- [ ] Require premium to render the approved dumbbell, ball, kettlebell, athlete, plate, and bag cutouts around an upright native card.
- [ ] Run the focused suite and verify failures identify the missing illustration-only contract.

### Task 2: Produce exact illustration-only assets

**Files:**
- Modify `scripts/extract-approved-onboarding-art.py`
- Replace assets in `assets/production/onboarding/extracted/`
- Add paywall cutouts under `assets/production/onboarding/extracted/premium/`

- [ ] Define explicit source crop rectangles for welcome, product value, why Formie, product demonstration, long-term value, loading, and six premium objects.
- [ ] Convert only near-black compositing pixels to alpha; retain every visible approved gold, white, gray, green, red, image, border, and texture pixel.
- [ ] Trim transparent edges without resizing or regenerating the artwork.
- [ ] Run the script and inspect each exported PNG at original detail.

### Task 3: Rebuild artwork pages as native screens

**Files:**
- Modify `src/screens/onboarding/approved-onboarding.tsx`
- Modify `src/theme/onboarding.ts` only if responsive tokens are required.

- [ ] Replace `ApprovedArtworkFrame` with an illustration-only image component.
- [ ] Render native logo/back/progress, eyebrow, highlighted title spans, subtitle, illustration, optional native closing line, and native CTA.
- [ ] Keep Welcome and Loading native, using only the approved logo/orbit illustration from the raster source.
- [ ] Scale illustration heights from safe-area density and remove rounded/framed artwork containers.

### Task 4: Rebuild the premium paywall

**Files:**
- Modify `src/screens/onboarding/premium-screen.tsx`

- [ ] Position the six exact approved decorative cutouts as noninteractive background art.
- [ ] Recreate the approved eyebrow, gold-highlighted headline, subtitle, upright pricing card, benefits, paid-period cancellation copy, and Go Now action natively.
- [ ] Preserve live RevenueCat price, disabled state, busy state, and purchase error behavior.
- [ ] Ensure decorations cannot intercept touches or push the pricing card outside the safe area.

### Task 5: Verify rendered behavior

**Files:**
- Test `src/screens/onboarding/approved-onboarding.test.tsx`
- Test `src/screens/auth/auth-screens.test.tsx`

- [ ] Run focused onboarding and auth tests.
- [ ] Run TypeScript and Expo lint.
- [ ] Run the full root Jest suite.
- [ ] Restart Metro with a cleared cache, fetch the fresh iOS manifest and exact bundle, and visually inspect representative marketing and premium screens at phone dimensions.
