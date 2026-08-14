export type CameraZoomLabel = "0.5x" | "1x" | "2x";

export type CameraZoomPreset = {
  label: CameraZoomLabel;
  lens: string | undefined;
  zoom: number;
};

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
  const minimum = hasUltraWide ? 0.5 : 1;
  return Math.min(4, Math.max(minimum, startMagnification * Math.max(scale, 0.01)));
}

export function resolveCameraMagnification(
  requestedMagnification: number,
  lenses: string[],
): { lens: string | undefined; magnification: number; zoom: number } {
  const ultraWide = lensContaining(lenses, "ultrawide");
  const wide = lensContaining(lenses, "wideangle") ?? lensContaining(lenses, "wide") ?? lenses[0];
  const minimum = ultraWide ? 0.5 : 1;
  const magnification = Math.min(4, Math.max(minimum, requestedMagnification));
  if (magnification < 1 && ultraWide) {
    return {
      lens: ultraWide,
      magnification,
      zoom: ((magnification - 0.5) / 0.5) * 0.12,
    };
  }
  return {
    lens: wide,
    magnification,
    zoom: (magnification - 1) * 0.12,
  };
}

export function zoomDisplayLabel(zoom: number, baseMagnification = 1): string {
  const magnification = baseMagnification === 0.5 ? 0.5 + (zoom / 0.12) * 0.5 : 1 + zoom / 0.12;
  return `${Math.max(0.5, magnification).toFixed(1)}x`;
}
