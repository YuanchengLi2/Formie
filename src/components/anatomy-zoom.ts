const MIN_ANATOMY_ZOOM = 0.55;
const MAX_ANATOMY_ZOOM = 1.42;

export function nextAnatomyZoom(current: number, scale: number): number {
  return Math.max(MIN_ANATOMY_ZOOM, Math.min(MAX_ANATOMY_ZOOM, current * scale));
}
