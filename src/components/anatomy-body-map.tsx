import { useEffect, useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Image } from "expo-image";

import {
  anatomyBodyZonesForRegion,
  type AnatomyBodyFace,
  type AnatomyBodyZone,
} from "@/components/anatomy-body-zones";
import type { AnatomyRegion, MuscleRegion } from "@/features/analysis/result-schema";
import { colors } from "@/theme/colors";
import { radii, spacing } from "@/theme/spacing";
import { typography } from "@/theme/type";

export type AnatomyModelProps = {
  targetRegions: MuscleRegion[];
  issueRegions: AnatomyRegion[];
};

type ColoredZone = AnatomyBodyZone & {
  kind: "target" | "issue";
  region: MuscleRegion | AnatomyRegion;
};

const TARGET_COLOR = "rgba(53, 208, 127, 0.58)";
const TARGET_BORDER = "rgba(92, 238, 159, 0.95)";
const ISSUE_COLOR = "rgba(240, 90, 90, 0.62)";
const ISSUE_BORDER = "rgba(255, 132, 132, 0.98)";

function coloredZones(targetRegions: MuscleRegion[], issueRegions: AnatomyRegion[]): ColoredZone[] {
  const zones = targetRegions.flatMap((region) =>
    anatomyBodyZonesForRegion(region).map((item) => ({ ...item, kind: "target" as const, region }))
  );
  const issueZones = issueRegions.flatMap((region) =>
    anatomyBodyZonesForRegion(region).map((item) => ({ ...item, kind: "issue" as const, region }))
  );
  const issueIds = new Set(issueZones.map((item) => `${item.face}:${item.id}`));
  return [
    ...zones.filter((item) => !issueIds.has(`${item.face}:${item.id}`)),
    ...issueZones,
  ];
}

function preferredFace(zones: ColoredZone[]): AnatomyBodyFace {
  const front = zones.filter((zone) => zone.face === "front").length;
  const back = zones.length - front;
  return back > front ? "back" : "front";
}

export function AnatomyModel({ targetRegions, issueRegions }: AnatomyModelProps) {
  const zones = useMemo(
    () => coloredZones(targetRegions, issueRegions),
    [issueRegions, targetRegions],
  );
  const regionKey = `${targetRegions.join(",")}|${issueRegions.join(",")}`;
  const [face, setFace] = useState<AnatomyBodyFace>(() => preferredFace(zones));

  useEffect(() => {
    setFace(preferredFace(zones));
    // The region key intentionally resets the face only when the selected map data changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [regionKey]);

  const visibleZones = zones.filter((zone) => zone.face === face);

  return (
    <View style={{ gap: spacing.sm }}>
      <View
        accessibilityRole="tablist"
        style={{
          flexDirection: "row",
          padding: 3,
          borderRadius: radii.md,
          borderCurve: "continuous",
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface,
        }}
      >
        {(["front", "back"] as const).map((value) => {
          const selected = face === value;
          return (
            <Pressable
              key={value}
              accessibilityLabel={`${value === "front" ? "Front" : "Back"} anatomy`}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              onPress={() => setFace(value)}
              style={{
                flex: 1,
                minHeight: 42,
                alignItems: "center",
                justifyContent: "center",
                borderRadius: radii.sm,
                backgroundColor: selected ? colors.gold : "transparent",
              }}
            >
              <Text selectable style={[typography.label, { color: selected ? colors.background : colors.textSecondary }]}>
                {value === "front" ? "Front" : "Back"}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View
        accessibilityLabel="Front and back anatomy map"
        testID="anatomy-gesture-surface"
        style={{
          width: "100%",
          aspectRatio: 728 / 1090,
          overflow: "hidden",
          borderRadius: radii.lg,
          borderCurve: "continuous",
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.background,
        }}
      >
        <Image
          accessibilityLabel={`${face === "front" ? "Front" : "Back"} anatomical muscle figure`}
          contentFit="fill"
          source={require("../../assets/production/anatomy-body-front-back.png")}
          testID="anatomy-body-image"
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: face === "front" ? "0%" : "-100%",
            width: "200%",
            height: "100%",
          }}
        />

        {visibleZones.map((item) => (
          <View
            key={`${item.kind}-${item.region}-${item.id}`}
            accessibilityLabel={`${item.kind === "target" ? "Target" : "Form issue"} ${item.region.replaceAll("_", " ")} on ${face} anatomy`}
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
              borderColor: item.kind === "issue" ? ISSUE_BORDER : TARGET_BORDER,
              backgroundColor: item.kind === "issue" ? ISSUE_COLOR : TARGET_COLOR,
              transform: item.rotate ? [{ rotate: `${item.rotate}deg` }] : undefined,
            }}
          />
        ))}

        {targetRegions.map((region) => (
          <View key={`target-${region}`} pointerEvents="none" testID={`anatomy-target-${region}`} />
        ))}
        {issueRegions.map((region) => (
          <View key={`issue-${region}`} pointerEvents="none" testID={`anatomy-issue-${region}`} />
        ))}
      </View>
    </View>
  );
}
