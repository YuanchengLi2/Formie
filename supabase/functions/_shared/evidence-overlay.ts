import type { PoseSummary } from "./pose-summary.ts";

export type EvidenceOverlay = {
  findingId: string;
  timeMs: number;
  centerX: number;
  centerY: number;
  radius: number;
  trackedAreas: string[];
};

type EvidenceFinding = {
  id: string;
  evidence: Array<{
    startMs: number;
    peakMs?: number;
    endMs: number;
    visibleBodyAreas: string[];
  }>;
};

const jointNames = ["Shoulder", "Elbow", "Wrist", "Hip", "Knee", "Ankle"] as const;
type JointName = typeof jointNames[number];
type Side = "left" | "right";

function jointsForArea(area: string): Array<{ side: Side; joint: JointName }> {
  const normalized = area.toLowerCase();
  const sides: Side[] = normalized.includes("left")
    ? ["left"]
    : normalized.includes("right")
      ? ["right"]
      : ["left", "right"];

  const implement = /bar|implement|dumbbell|weight|handle|grip/.test(normalized);
  const requested = implement
    ? ["Wrist" as const]
    : jointNames.filter((joint) => normalized.includes(joint.toLowerCase()));

  if (requested.length === 0 && /arm/.test(normalized)) requested.push("Shoulder", "Elbow", "Wrist");
  if (requested.length === 0 && /torso|trunk|chest|back/.test(normalized)) requested.push("Shoulder", "Hip");
  if (requested.length === 0 && /leg|stance/.test(normalized)) requested.push("Hip", "Knee", "Ankle");

  return sides.flatMap((side) => requested.map((joint) => ({ side, joint })));
}

function rounded(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

export function buildEvidenceOverlays(summary: PoseSummary, findings: EvidenceFinding[]): EvidenceOverlay[] {
  const columnIndex = new Map(summary.seriesColumns.map((column, index) => [column, index]));

  return findings.flatMap((finding) => {
    const evidence = finding.evidence[0];
    if (!evidence) return [];
    const requestedTime = evidence.peakMs ?? Math.round((evidence.startMs + evidence.endMs) / 2);
    const row = summary.series.reduce<(number | null)[] | null>((nearest, candidate) => {
      if (typeof candidate[0] !== "number") return nearest;
      if (!nearest || Math.abs(candidate[0] - requestedTime) < Math.abs(Number(nearest[0]) - requestedTime)) return candidate;
      return nearest;
    }, null);
    if (!row || typeof row[0] !== "number" || Math.abs(row[0] - requestedTime) > 750) return [];

    const trackedAreas: string[] = [];
    const points: Array<{ x: number; y: number }> = [];
    for (const area of evidence.visibleBodyAreas) {
      let grounded = false;
      for (const { side, joint } of jointsForArea(area)) {
        const x = row[columnIndex.get(`${side}${joint}X`) ?? -1];
        const y = row[columnIndex.get(`${side}${joint}Y`) ?? -1];
        if (typeof x !== "number" || typeof y !== "number" || x < 0 || x > 1 || y < 0 || y > 1) continue;
        points.push({ x, y });
        grounded = true;
      }
      if (grounded) trackedAreas.push(area);
    }
    if (points.length === 0) return [];

    const centerX = points.reduce((sum, point) => sum + point.x, 0) / points.length;
    const centerY = points.reduce((sum, point) => sum + point.y, 0) / points.length;
    const radius = Math.min(0.28, Math.max(0.11, ...points.map((point) => Math.hypot(point.x - centerX, point.y - centerY) + 0.08)));

    return [{
      findingId: finding.id,
      timeMs: row[0],
      centerX: rounded(centerX),
      centerY: rounded(centerY),
      radius: rounded(radius),
      trackedAreas,
    }];
  });
}
