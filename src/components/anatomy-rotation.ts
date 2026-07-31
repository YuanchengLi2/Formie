const FULL_ROTATION = Math.PI * 2;
const DRAG_RADIANS_PER_PIXEL = 0.018;

export function anatomyRotationFromSlider(positionX: number, width: number): number {
  if (!Number.isFinite(width) || width <= 0) return 0;
  const progress = Math.max(0, Math.min(1, positionX / width));
  return progress * FULL_ROTATION;
}

export function anatomyRotationFromDrag(startRotation: number, deltaX: number): number {
  return startRotation + deltaX * DRAG_RADIANS_PER_PIXEL;
}

export function normalizedAnatomyRotation(rotation: number): number {
  const wrapped = ((rotation % FULL_ROTATION) + FULL_ROTATION) % FULL_ROTATION;
  if (rotation > 0 && Math.abs(wrapped) < Number.EPSILON * 16) return 1;
  return wrapped / FULL_ROTATION;
}
