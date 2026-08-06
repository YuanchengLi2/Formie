import { Pressable, Text, View } from "react-native";

import { onboardingPreviewFixture, type OnboardingPreviewTab } from "@/features/onboarding/preview-fixture";
import { onboardingTheme as theme } from "@/theme/onboarding";

type PreviewDensity = "regular" | "compact" | "short";

export function AnalysisTabs({ tab, onChange, density = "regular" }: { tab: OnboardingPreviewTab; onChange?: (tab: OnboardingPreviewTab) => void; density?: PreviewDensity }) {
  const labels: [OnboardingPreviewTab, string][] = [["what", "What happened"], ["why", "Why it matters"], ["next", "What to do next"]];
  return (
    <View accessibilityRole="tablist" style={{ flexDirection: "row", borderBottomWidth: 1, borderBottomColor: theme.colors.border }}>
      {labels.map(([value, label]) => (
        <Pressable key={value} accessibilityRole="tab" accessibilityLabel={label} accessibilityState={{ selected: tab === value }} onPress={() => onChange?.(value)} style={{ flex: 1, minHeight: density === "short" ? 32 : 44, alignItems: "center", justifyContent: "center", paddingHorizontal: 4, borderBottomWidth: 2, borderBottomColor: tab === value ? theme.colors.gold : "transparent" }}>
          <Text selectable style={{ color: tab === value ? theme.colors.gold : theme.colors.textMuted, fontSize: density === "short" ? 8 : 10, fontWeight: "600", textAlign: "center" }}>{label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export function LayeredAnalysisPreview({ tab = "what", onTabChange, density = "regular" }: { tab?: OnboardingPreviewTab; onTabChange?: (tab: OnboardingPreviewTab) => void; density?: PreviewDensity }) {
  const copy = tab === "what" ? onboardingPreviewFixture.whatHappened : tab === "why" ? onboardingPreviewFixture.whyItMatters : onboardingPreviewFixture.whatToDo;
  const short = density === "short";
  const compact = density !== "regular";
  const pad = short ? 7 : compact ? 10 : theme.spacing.md;
  const gap = short ? 5 : compact ? 8 : theme.spacing.md;
  return (
    <View testID="layered-analysis-preview" style={{ gap, flexShrink: 1, overflow: "hidden" }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap }}>
        <View testID="preview-video-frame" style={{ flex: 1, height: short ? 66 : compact ? 88 : 126, borderRadius: theme.radius.medium, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: "#201E19", alignItems: "center", justifyContent: "center" }}>
          <View style={{ width: short ? 34 : 58, height: short ? 45 : 76, borderRadius: 28, borderWidth: 2, borderColor: theme.colors.goldMuted, opacity: 0.9 }} />
          <Text selectable style={{ position: "absolute", bottom: 8, color: theme.colors.textMuted, fontSize: 10 }}>{onboardingPreviewFixture.timestamp}</Text>
        </View>
        <View style={{ width: short ? 66 : 96, gap: short ? 3 : theme.spacing.sm }}>
          <Text selectable style={{ color: theme.colors.gold, fontSize: 10, fontWeight: "700" }}>SCORE</Text>
          <Text selectable style={{ color: theme.colors.text, fontSize: short ? 22 : 32, fontWeight: "700" }}>{onboardingPreviewFixture.score}</Text>
          <Text selectable style={{ color: theme.colors.textMuted, fontSize: 10 }}>{onboardingPreviewFixture.exercise}</Text>
        </View>
      </View>
      <View style={{ borderRadius: theme.radius.medium, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surface }}>
        <View style={{ padding: pad, gap: theme.spacing.xs }}>
          <Text selectable style={{ color: theme.colors.gold, fontSize: 10, fontWeight: "700", letterSpacing: 1 }}>{onboardingPreviewFixture.issueTitle.toUpperCase()}</Text>
          <Text selectable style={{ color: theme.colors.textMuted, fontSize: 10 }}>{onboardingPreviewFixture.timestamp} · visible moment</Text>
        </View>
        <AnalysisTabs tab={tab} onChange={onTabChange} density={density} />
        <View style={{ padding: pad, gap: theme.spacing.xs }}>
          <Text selectable style={{ color: theme.colors.text, fontSize: short ? 10 : 14, lineHeight: short ? 13 : 20, fontWeight: "700" }}>{copy}</Text>
          {!short && tab !== "next" ? <Text selectable style={{ color: theme.colors.textMuted, fontSize: 12, lineHeight: 18 }}>{tab === "what" ? onboardingPreviewFixture.summary : onboardingPreviewFixture.successCheck}</Text> : null}
        </View>
      </View>
      {!short ? <View style={{ flexDirection: "row", gap: theme.spacing.sm }}>
        <View style={{ flex: 1, padding: pad, borderRadius: theme.radius.small, backgroundColor: theme.colors.surfaceRaised, gap: theme.spacing.xs }}>
          <Text selectable style={{ color: theme.colors.textMuted, fontSize: 10, fontWeight: "700" }}>WHOLE SET SUMMARY</Text>
          <Text selectable style={{ color: theme.colors.text, fontSize: 12, lineHeight: 17 }}>{onboardingPreviewFixture.summary}</Text>
        </View>
        <View style={{ flex: 1, padding: pad, borderRadius: theme.radius.small, backgroundColor: theme.colors.positiveSurface, gap: theme.spacing.xs }}>
          <Text selectable style={{ color: theme.colors.positive, fontSize: 10, fontWeight: "700" }}>WHAT YOU DID WELL</Text>
          <Text selectable style={{ color: theme.colors.text, fontSize: 12, lineHeight: 17 }}>{onboardingPreviewFixture.strengths.join(" · ")}</Text>
        </View>
      </View> : null}
      <View style={{ padding: pad, borderRadius: theme.radius.small, backgroundColor: theme.colors.cueSurface, gap: theme.spacing.xs }}>
        <Text selectable style={{ color: theme.colors.gold, fontSize: 10, fontWeight: "700" }}>NEXT-SET CUE</Text>
        <Text selectable style={{ color: theme.colors.text, fontSize: 13, lineHeight: 18, fontWeight: "600" }}>{onboardingPreviewFixture.cue}</Text>
      </View>
    </View>
  );
}
