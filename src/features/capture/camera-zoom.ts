export type CameraZoomLabel = "0.5x" | "1x" | "2x";

export type CameraZoomPreset = {
  label: CameraZoomLabel;
  lens: string | undefined;
  zoom: number;
};

export const CAMERA_LENS_HYSTERESIS = 0.06;

export function mergeCameraLensInventory(current: readonly string[], incoming: readonly string[]): string[] {
  return Array.from(new Set([...current, ...incoming]));
}

function lensContaining(lenses: string[], term: string): string | undefined {
  const normalizedTerm = term.toLocaleLowerCase().replace(/[^a-z0-9]+/g, "");
  return lenses.find((lens) => lens.toLocaleLowerCase().replace(/[^a-z0-9]+/g, "").includes(normalizedTerm));
}

export function resolveCameraZoom(label: CameraZoomLabel, lenses: string[]): { lens: string | undefined; zoom: number } {
  const wide = lensContaining(lenses, "wideangle") ?? lensContaining(lenses, "wide") ?? lenses[0];
  if (label === "0.5x") return { lens: lensContaining(lenses, "ultrawide"), zoom: 0 };
  if (label === "2x") return { lens: wide, zoom: 0.12 };
  return { lens: wide, zoom: 0 };
}

export function cameraZoomPresets(lenses: string[]): CameraZoomPreset[] {
  const labels: CameraZoomLabel[] = lensContaining(lenses, "ultrawide") ? ["0.5x", "1x", "2x"] : ["1x", "2x"];
  return labels.map((label) => ({ label, ...resolveCameraZoom(label, lenses) }));
}

export function pinchZoom(startZoom: number, scale: number): number {
  const delta = Math.log2(Math.max(scale, 0.01)) * 0.12;
  return Math.min(0.36, Math.max(0, startZoom + delta));
}

export function pinchMagnification(startMagnification: number, scale: number, hasUltraWide: boolean): number {
  "worklet";
  const minimum = hasUltraWide ? 0.5 : 1;
  // Work in log space so the same finger movement feels proportional in both
  // directions instead of making the wide end feel artificially slow.
  const safeStart = Math.max(minimum, Math.min(4, startMagnification));
  const safeScale = Math.max(scale, 0.01);
  const next = Math.exp(Math.log(safeStart) + Math.log(safeScale));
  return Math.min(4, Math.max(minimum, next));
}

export function lensForMagnification(
  requestedMagnification: number,
  lenses: string[],
  previousLens?: string,
): string | undefined {
  const ultraWide = lensContaining(lenses, "ultrawide");
  const wide = lensContaining(lenses, "wideangle") ?? lensContaining(lenses, "wide") ?? lenses[0];
  if (!ultraWide) return wide;
  const previousIsUltraWide = previousLens === ultraWide;
  const threshold = previousIsUltraWide
    ? 1 + CAMERA_LENS_HYSTERESIS
    : 1 - CAMERA_LENS_HYSTERESIS;
  return requestedMagnification < threshold ? ultraWide : wide;
}

export function resolveCameraMagnification(
  requestedMagnification: number,
  lenses: string[],
  previousLens?: string,
): { lens: string | undefined; magnification: number; zoom: number } {
  const ultraWide = lensContaining(lenses, "ultrawide");
  const minimum = ultraWide ? 0.5 : 1;
  const magnification = Math.min(4, Math.max(minimum, requestedMagnification));
  const lens = lensForMagnification(magnification, lenses, previousLens);
  if (lens === ultraWide && ultraWide) {
    return {
      lens: ultraWide,
      magnification,
      zoom: ((magnification - 0.5) / 0.5) * 0.12,
    };
  }
  return {
    lens,
    magnification,
    zoom: Math.max(0, (magnification - 1) * 0.12),
  };
}

export function cameraLensDetent(magnification: number, hasUltraWide: boolean): "0.5x" | "1x" | "2x" {
  if (!hasUltraWide) return magnification >= 1.75 ? "2x" : "1x";
  if (hasUltraWide && magnification <= 0.5) return "0.5x";
  if (magnification >= 1.75) return "2x";
  if (magnification >= 0.8) return "1x";
  return "0.5x";
}

export function zoomDisplayLabel(zoom: number, baseMagnification = 1): string {
  const magnification = baseMagnification === 0.5 ? 0.5 + (zoom / 0.12) * 0.5 : 1 + zoom / 0.12;
  return `${Math.max(0.5, magnification).toFixed(1)}x`;
}
