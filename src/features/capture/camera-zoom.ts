export type CameraZoomLabel = "0.5x" | "1x" | "2x";

export type CameraZoomPreset = {
  label: CameraZoomLabel;
  lens: string | undefined;
  zoom: number;
};

function lensContaining(lenses: string[], term: string): string | undefined {
  return lenses.find((lens) => lens.toLocaleLowerCase().includes(term));
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

export function zoomDisplayLabel(zoom: number, baseMagnification = 1): string {
  const magnification = baseMagnification === 0.5 ? 0.5 + (zoom / 0.12) * 0.5 : 1 + zoom / 0.12;
  return `${Math.max(0.5, magnification).toFixed(1)}x`;
}
