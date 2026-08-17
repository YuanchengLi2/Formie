import { useState } from "react";
import { Text, View } from "react-native";
import { HapticPressable as Pressable } from "@/components/haptic-pressable";

import { AnatomyModel } from "@/components/anatomy-model";
import type { AnatomyRegion, MuscleFocus } from "@/features/analysis/result-schema";
import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import { typography } from "@/theme/type";

const TARGET_COLOR = "#35D07F";
const SECONDARY_COLOR = colors.danger;
const ISSUE_COLOR = "#F1B542";

function LegendLine({ color, label, names }: { color: string; label: string; names: string[] }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-start", gap: spacing.sm }}>
      <View style={{ width: 12, height: 12, marginTop: 4, borderRadius: 3, backgroundColor: color }} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text selectable style={[typography.label, { color: colors.text }]}>{label}</Text>
        <Text selectable style={{ color: colors.textSecondary, fontSize: 14, lineHeight: 20 }}>{names.length > 0 ? names.join(", ") : "None identified from this recording"}</Text>
      </View>
    </View>
  );
}

function displayRegion(region: AnatomyRegion): string {
  return region.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function MuscleFocusFigure({ focus, issueRegions }: { focus: MuscleFocus | null; issueRegions: AnatomyRegion[] }) {
  const [view, setView] = useState<"targets" | "form">(issueRegions.length > 0 ? "form" : "targets");
  const primary = focus?.primary ?? [];
  const secondary = focus?.secondary ?? [];
  const targets = [...primary, ...secondary];
  const targetRegions = Array.from(new Set(primary.map((target) => target.region)));
  const secondaryRegions = Array.from(new Set(secondary.map((target) => target.region)));
  return (
    <View testID="muscle-focus-figure" style={{ gap: spacing.md }}>
      <View accessibilityRole="tablist" style={{ flexDirection: "row", padding: 3, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }}>
        {([
          ["targets", "Target Muscles"],
          ["form", "Your Form"],
        ] as const).filter(([value]) => value !== "targets" || targets.length > 0).map(([value, label]) => {
          const selected = view === value;
          return (
            <Pressable key={value} accessibilityLabel={label} accessibilityRole="tab" accessibilityState={{ selected }} onPress={() => setView(value)} style={{ flex: 1, minHeight: 44, alignItems: "center", justifyContent: "center", borderRadius: 9, backgroundColor: selected ? (value === "targets" ? TARGET_COLOR : ISSUE_COLOR) : "transparent" }}>
              <Text style={[typography.label, { color: selected ? colors.background : colors.textSecondary }]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>
      <AnatomyModel
        mode={view === "form" ? "form" : "muscles"}
        targetRegions={view === "targets" ? targetRegions : []}
        secondaryRegions={view === "targets" ? secondaryRegions : []}
        issueRegions={view === "form" ? issueRegions : []}
      />
      {view === "targets"
        ? <View style={{ gap: spacing.sm }}>
          <LegendLine color={TARGET_COLOR} label="Primary muscles" names={primary.map((target) => target.name)} />
          <LegendLine color={SECONDARY_COLOR} label="Supporting muscles" names={secondary.map((target) => target.name)} />
        </View>
        : <LegendLine color={ISSUE_COLOR} label="Observed issue areas" names={issueRegions.map(displayRegion)} />}
      <Text selectable style={[typography.caption, { color: colors.textMuted }]}>
        Z-Anatomy-derived model · CC BY-SA 4.0
      </Text>
    </View>
  );
}
