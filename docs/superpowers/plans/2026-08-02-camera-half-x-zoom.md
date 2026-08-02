# Camera 0.5x Zoom Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reliably expose the native `0.5x` camera preset on supported iPhones by querying the mounted camera's available lenses when it becomes ready.

**Architecture:** Keep lens-name interpretation in `camera-zoom.ts` and camera lifecycle state in `CameraScreen`. Route readiness queries and native lens-change events through one callback that stores capabilities and initializes the default wide lens without blocking recording on query failure.

**Tech Stack:** React Native, Expo Camera 17, TypeScript, Jest, React Native Testing Library

## Global Constraints

- `0.5x` must select a real native ultra-wide lens, not simulate zooming out.
- Hide `0.5x` when the active camera does not expose an ultra-wide lens.
- Lens discovery failure must not block preview or recording.
- Preserve `1x`, `2x`, pinch zoom, camera flip, countdown, and recording behavior.

---

### Task 1: Reliable Native Lens Discovery

**Files:**
- Modify: `src/screens/camera/camera.test.tsx`
- Modify: `src/screens/camera/index.tsx`
- Verify: `src/features/capture/camera-zoom.test.ts`
- Verify: `src/screens/camera/camera-controls.test.tsx`

**Interfaces:**
- Consumes: `CameraView.getAvailableLensesAsync(): Promise<string[]>`, `resolveCameraZoom(label, lenses)`, and `cameraZoomPresets(lenses)`.
- Produces: `onCameraReady` behavior that queries native lenses and updates the existing `availableLenses`, `selectedLens`, and `activeZoomLabel` state.

- [ ] **Step 1: Write the failing readiness-discovery test**

Add a `CameraView` test double whose ref exposes `getAvailableLensesAsync`. Render `CameraScreen`, invoke the preview's `onCameraReady`, resolve the method with `['builtInWideAngleCamera', 'builtInUltraWideCamera']`, then assert that `Camera zoom 0.5x` appears and selecting it sets `selectedLens` to `builtInUltraWideCamera`.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npx jest src/screens/camera/camera.test.tsx --runInBand`

Expected: FAIL because the current `CameraView` has no `onCameraReady` lens query and therefore does not reveal `0.5x` without a lens-change event.

- [ ] **Step 3: Implement one lens-application callback**

In `CameraScreen`, add a callback with this behavior:

```ts
const applyAvailableLenses = useCallback((lenses: string[]) => {
  setAvailableLenses(lenses);
  if (selectedLens === undefined) {
    const preset = resolveCameraZoom('1x', lenses);
    setSelectedLens(preset.lens);
    setActiveZoomLabel('1x');
    setCameraZoom(preset.zoom);
  }
}, [selectedLens, setCameraZoom]);
```

Use it from `onAvailableLensesChanged`. Add `onCameraReady` that calls `cameraRef.current?.getAvailableLensesAsync()`, passes the result to `applyAvailableLenses`, and ignores rejection so camera use remains available.

- [ ] **Step 4: Add the non-ultra-wide and rejected-query coverage**

Verify that readiness returning `['builtInWideAngleCamera']` does not render `Camera zoom 0.5x`. Verify a rejected readiness query does not surface an error and the `Start countdown` control remains available.

- [ ] **Step 5: Run focused camera tests and verify GREEN**

Run: `npx jest src/screens/camera/camera.test.tsx src/screens/camera/camera-controls.test.tsx src/features/capture/camera-zoom.test.ts --runInBand`

Expected: all focused tests pass.

- [ ] **Step 6: Run static verification**

Run: `npx tsc --noEmit`

Expected: exit code 0.

- [ ] **Step 7: Verify the live development bundle**

Keep the existing Formai Metro server on port 8081, fetch the iOS Expo manifest with Expo protocol headers, then fetch its exact `launchAsset.url`. Confirm the LAN status is `packager-status:running`, manifest HTTP is 200, and bundle HTTP is 200.

- [ ] **Step 8: Commit the focused implementation**

```powershell
git add -- src/screens/camera/index.tsx src/screens/camera/camera.test.tsx docs/superpowers/plans/2026-08-02-camera-half-x-zoom.md
git commit -m "feat: reveal native 0.5x camera lens"
```

