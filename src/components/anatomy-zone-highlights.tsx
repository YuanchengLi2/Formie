import { useMemo } from "react";
import { View } from "react-native";

import {
  anatomyBodyZonesForRegion,
  type AnatomyBodyFace,
  type AnatomyBodyZone,
} from "@/components/anatomy-body-zones";
import type { AnatomyRegion, MuscleRegion } from "@/features/analysis/result-schema";

type ColoredZone = AnatomyBodyZone & {
  kind: "target" | "secondary" | "issue";
  region: MuscleRegion | AnatomyRegion;
};

const TARGET_COLOR = "rgba(53, 208, 127, 0.58)";
const TARGET_BORDER = "rgba(92, 238, 159, 0.95)";
const SECONDARY_COLOR = "rgba(240, 90, 90, 0.62)";
const SECONDARY_BORDER = "rgba(255, 132, 132, 0.98)";
const ISSUE_COLOR = "rgba(241, 181, 66, 0.68)";
const ISSUE_BORDER = "rgba(255, 211, 112, 0.98)";

function coloredZones(targetRegions: MuscleRegion[], secondaryRegions: MuscleRegion[], issueRegions: AnatomyRegion[]): ColoredZone[] {
  const targets = targetRegions.flatMap((region) =>
    anatomyBodyZonesForRegion(region).map((item) => ({ ...item, kind: "target" as const, region })),
  );
  const issues = issueRegions.flatMap((region) =>
    anatomyBodyZonesForRegion(region).map((item) => ({ ...item, kind: "issue" as const, region })),
  );
  const secondary = secondaryRegions.flatMap((region) =>
    anatomyBodyZonesForRegion(region).map((item) => ({ ...item, kind: "secondary" as const, region })),
  );
  const issueIds = new Set(issues.map((item) => `${item.face}:${item.id}`));
  const secondaryIds = new Set(secondary.map((item) => `${item.face}:${item.id}`));
  return [
    ...targets.filter((item) => !issueIds.has(`${item.face}:${item.id}`) && !secondaryIds.has(`${item.face}:${item.id}`)),
    ...secondary.filter((item) => !issueIds.has(`${item.face}:${item.id}`)),
    ...issues,
  ];
}

export function AnatomyZoneHighlights({
  targetRegions,
  secondaryRegions,
  issueRegions,
  face,
}: {
  targetRegions: MuscleRegion[];
  secondaryRegions: MuscleRegion[];
  issueRegions: AnatomyRegion[];
  face: AnatomyBodyFace;
}) {
  const zones = useMemo(
    () => coloredZones(targetRegions, secondaryRegions, issueRegions).filter((item) => item.face === face),
    [face, issueRegions, secondaryRegions, targetRegions],
  );

  return (
    <>
      {zones.map((item) => (
        <View
          key={`${item.kind}-${item.region}-${item.id}`}
          pointerEvents="none"
          testID={`anatomy-highlight-${item.kind}-${item.region}-${item.id}`}
          style={{
            position: "absolute",
            left: `${item.x * 100}%`,
            top: `${item.y * 100}%`,
            width: `${item.width * 100}%`,
            height: `${item.height * 100}%`,
            borderRadius: 999,
            borderWidth: 1.5,
            borderColor: item.kind === "issue" ? ISSUE_BORDER : item.kind === "secondary" ? SECONDARY_BORDER : TARGET_BORDER,
            backgroundColor: item.kind === "issue" ? ISSUE_COLOR : item.kind === "secondary" ? SECONDARY_COLOR : TARGET_COLOR,
            transform: item.rotate ? [{ rotate: `${item.rotate}deg` }] : undefined,
          }}
        />
      ))}
    </>
  );
}
