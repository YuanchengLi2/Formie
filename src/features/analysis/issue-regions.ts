import { anatomyRegions, type AnatomyRegion } from "./result-schema";

type IssueRegionSource = {
  observedIssueRegions?: AnatomyRegion[];
  evidence: { visibleBodyAreas: string[] }[];
};

const anatomyRegionSet = new Set<string>(anatomyRegions);
const aliases: Record<string, AnatomyRegion> = {
  ankle: "ankles",
  foot: "ankles",
  feet: "ankles",
  shoulder: "shoulders",
  elbow: "elbows",
  wrist: "wrists",
  hip: "hips",
  knee: "knees",
  calf: "calves",
  thigh: "quads",
  thighs: "quads",
  arm: "upper_arms",
  arms: "upper_arms",
  "upper arm": "upper_arms",
  "upper arms": "upper_arms",
  "shoulder blade": "upper_back",
  "shoulder blades": "upper_back",
  scapula: "upper_back",
  scapulae: "upper_back",
  "upper back": "upper_back",
  "lower back": "lower_back",
};

function normalizeVisibleArea(value: string): AnatomyRegion | null {
  const normalized = value.toLowerCase().trim()
    .replace(/[-_]+/g, " ")
    .replace(/\b(?:left|right|both|bilateral)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const underscored = normalized.replaceAll(" ", "_");
  if (anatomyRegionSet.has(underscored)) return underscored as AnatomyRegion;
  return aliases[normalized] ?? null;
}

function visibleAreaRegions(value: string): AnatomyRegion[] {
  const direct = normalizeVisibleArea(value);
  if (direct) return [direct];
  return value
    .split(/\s*(?:,|\/|&|\band\b)\s*/i)
    .map(normalizeVisibleArea)
    .filter((region): region is AnatomyRegion => region !== null);
}

export function deriveObservedIssueRegions(findings: IssueRegionSource[]): AnatomyRegion[] {
  const regions: AnatomyRegion[] = [];
  const add = (region: AnatomyRegion) => {
    if (!regions.includes(region)) regions.push(region);
  };

  for (const finding of findings) {
    if ((finding.observedIssueRegions?.length ?? 0) > 0) {
      finding.observedIssueRegions?.forEach(add);
      continue;
    }
    finding.evidence.flatMap((moment) => moment.visibleBodyAreas).forEach((area) => {
      visibleAreaRegions(area).forEach(add);
    });
  }
  return regions;
}
