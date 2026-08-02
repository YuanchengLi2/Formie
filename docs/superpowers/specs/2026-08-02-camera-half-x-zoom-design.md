# Camera 0.5x Zoom Design

## Goal

Let a person recording an exercise select a real `0.5x` view when the active device camera exposes an ultra-wide lens. The control must switch the native camera lens, not simulate zooming out by cropping or scaling the preview.

## Current behavior and problem

The camera screen already renders `0.5x`, `1x`, and `2x` presets from its known lens list and can switch `selectedLens` to an ultra-wide camera. However, it relies on `onAvailableLensesChanged` to populate that list. Expo Camera also exposes `getAvailableLensesAsync()` for the mounted camera, so relying on the event alone can leave the list empty and hide `0.5x` even when the iPhone supports it.

## Design

When the camera becomes ready, query the mounted `CameraView` for its available lenses. Feed both the readiness query and later lens-change events through one lens-selection function so capability detection and default `1x` initialization remain consistent.

The zoom controls remain compact presets above the record button:

- Show `0.5x` only when an ultra-wide lens is present.
- Selecting `0.5x` changes `selectedLens` to the native ultra-wide lens with camera zoom at zero.
- Selecting `1x` returns to the native wide-angle lens at zoom zero.
- Selecting `2x` uses the wide-angle lens with the existing zoom value.
- Flipping cameras clears stale lens state; the newly active camera is queried again when ready.
- Pinch zoom remains available and clears the selected preset indicator while the person is between presets.

Devices without an ultra-wide lens continue to show `1x` and `2x`. The app does not display a nonfunctional `0.5x` control or claim that digital scaling can widen the physical camera field of view.

## Failure handling

Lens discovery is an enhancement to an otherwise usable camera. If the imperative lens query is unavailable or rejects, the preview and recording controls remain functional, and the existing lens-change event can still populate presets. The app must not block recording because lens discovery failed.

## Testing

Tests will prove that:

- Camera readiness queries native lenses and reveals `0.5x` when ultra-wide is returned.
- Selecting `0.5x` chooses the reported ultra-wide native lens.
- A device without ultra-wide does not show `0.5x`.
- A lens-query failure leaves the camera usable.
- Existing capture lifecycle, camera controls, and camera-zoom tests remain green.

