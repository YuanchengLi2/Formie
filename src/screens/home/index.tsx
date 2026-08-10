import { Image } from "expo-image";
import { Pressable, ScrollView, Text, useWindowDimensions, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

import { ExerciseFamilyIcon } from "@/components/exercise-family-icon";
import { DashboardIcon } from "@/components/dashboard-icon";
import { FormCard } from "@/components/form-card";
import { FormWordmark } from "@/components/form-wordmark";
import { ProgressMetricsPanel } from "@/components/progress-metrics";
import { AnalysisQuotaBar } from "@/components/analysis-quota-bar";
import type { ExerciseFamily } from "@/features/exercises/exercise-family";
import type { AnalysisHistoryStatus } from "@/features/progress/group-sessions";
import type { ProgressMetrics } from "@/features/progress/metrics";
import { colors } from "@/theme/colors";
import { radii, spacing } from "@/theme/spacing";
import { typography } from "@/theme/type";

const recordCard = require("../../../assets/production/home-record-card.png");

export function emptyHomeHeroHeight(viewportWidth: number, viewportHeight: number): number {
  return Math.min(300, Math.max(220, Math.floor(Math.min(viewportHeight * 0.34, viewportWidth * 0.78))));
}

type HomeAnalysis = {
  sessionId: string;
  status: AnalysisHistoryStatus;
  label: string;
  createdAt: string;
  score: number | null;
  exerciseFamily?: ExerciseFamily | null;
  priorityCorrectionTitles?: string[];
};

type HomeScreenProps = {
  historyResolved?: boolean;
  recentAnalyses?: HomeAnalysis[];
  onOpenSession?: (sessionId: string, status: AnalysisHistoryStatus) => void;
  onOpenProfile?: () => void;
  onOpenCoach?: () => void;
  onOpenProgress?: () => void;
  metrics?: ProgressMetrics | null;
  metricsLoading?: boolean;
  analysisRemaining?: number | null;
  analysisLimit?: number | null;
  analysisStatus?: "ready" | "checking" | "expired" | "purchase";
  now?: Date;
};

function HomeHeader({ onOpenProfile, analysisRemaining, analysisLimit, analysisStatus }: { onOpenProfile: () => void; analysisRemaining: number | null; analysisLimit: number | null; analysisStatus: "ready" | "checking" | "expired" | "purchase" }) {
  return (
    <View testID="home-top-bar" style={{ minHeight: 68, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
      <FormWordmark size={56} />
      <View testID="home-header-actions" style={{ flex: 1, minWidth: 0, maxWidth: 250, marginLeft: spacing.md, flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: spacing.sm }}>
        <AnalysisQuotaBar remaining={analysisRemaining} limit={analysisLimit} status={analysisStatus} />
        <Pressable accessibilityLabel="Open settings" accessibilityRole="button" onPress={onOpenProfile} style={{ width: 46, height: 46, alignItems: "center", justifyContent: "center", borderRadius: radii.pill, borderWidth: 1, borderColor: colors.gold }}>
          <View style={{ width: 9, height: 9, borderRadius: 5, borderWidth: 1, borderColor: colors.gold }} />
          <View style={{ width: 17, height: 8, marginTop: 3, borderTopLeftRadius: 9, borderTopRightRadius: 9, borderWidth: 1, borderBottomWidth: 0, borderColor: colors.gold }} />
        </Pressable>
      </View>
    </View>
  );
}

function RecordingArtwork({ height }: { height: number }) {
  return (
    <View testID="first-recording-artwork" style={{ height, overflow: "hidden", borderRadius: radii.lg, borderWidth: 1, borderColor: colors.border }}>
      <Image accessibilityLabel="Person squatting inside the Formie camera frame" source={recordCard} contentFit="cover" style={{ width: "100%", height: "100%" }} />
    </View>
  );
}

export function HomeScreen({
  historyResolved = true,
  recentAnalyses = [],
  onOpenSession = () => undefined,
  onOpenProfile = () => undefined,
  onOpenCoach = () => undefined,
  onOpenProgress = () => undefined,
  metrics = null,
  metricsLoading = false,
  analysisRemaining = null,
  analysisLimit = 10,
  analysisStatus = "checking",
  now = new Date(),
}: HomeScreenProps) {
  const viewport = useWindowDimensions();
  if (!historyResolved) {
    return (
      <View accessibilityLabel="Loading recording history" style={{ flex: 1, gap: spacing.lg, padding: spacing.lg, backgroundColor: colors.background }}>
        <HomeHeader onOpenProfile={onOpenProfile} analysisRemaining={analysisRemaining} analysisLimit={analysisLimit} analysisStatus={analysisStatus} />
        <View style={{ flex: 1, justifyContent: "center", gap: spacing.md, opacity: 0.52 }}>
          <View style={{ width: "72%", height: 38, borderRadius: radii.sm, backgroundColor: colors.surfaceRaised }} />
          <View style={{ width: "92%", height: 300, borderRadius: radii.lg, backgroundColor: colors.surface }} />
        </View>
      </View>
    );
  }

  const commonContentStyle = { gap: spacing.xl, padding: spacing.lg, paddingBottom: spacing.xxl };
  if (recentAnalyses.length === 0) {
    return (
      <ScrollView accessibilityLabel="First recording hero" alwaysBounceVertical bounces overScrollMode="auto" contentInsetAdjustmentBehavior="automatic" style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={commonContentStyle}>
        <HomeHeader onOpenProfile={onOpenProfile} analysisRemaining={analysisRemaining} analysisLimit={analysisLimit} analysisStatus={analysisStatus} />
        <Animated.View entering={FadeInDown.duration(220)} style={{ gap: spacing.sm }}>
          <Text selectable style={[typography.title, { color: colors.text }]}>Ready to move better?</Text>
          <Text selectable style={[typography.body, { maxWidth: 330, color: colors.textSecondary }]}>Record a set. Get clear coaching on what changed.</Text>
        </Animated.View>
        <ProgressMetricsPanel layout="horizontal" metrics={metrics} loading={metricsLoading} />
        <Animated.View entering={FadeInDown.duration(260).delay(45)}>
          <RecordingArtwork height={emptyHomeHeroHeight(viewport.width, viewport.height)} />
        </Animated.View>
      </ScrollView>
    );
  }

  const latest = recentAnalyses[0];
  const weekThreshold = now.getTime() - 7 * 24 * 60 * 60 * 1_000;
  const weeklyCount = recentAnalyses.filter((analysis) => Date.parse(analysis.createdAt) >= weekThreshold).length;
  const weekLabel = `${weeklyCount} ${weeklyCount === 1 ? "analysis" : "analyses"} this week`;

  return (
    <ScrollView alwaysBounceVertical bounces overScrollMode="auto" contentInsetAdjustmentBehavior="automatic" style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={commonContentStyle}>
      <HomeHeader onOpenProfile={onOpenProfile} analysisRemaining={analysisRemaining} analysisLimit={analysisLimit} analysisStatus={analysisStatus} />
      <Animated.View entering={FadeInDown.duration(220)} style={{ gap: spacing.xs }}>
        <Text selectable style={[typography.title, { color: colors.text }]}>Your Formie dashboard</Text>
        <Text selectable style={[typography.body, { color: colors.textSecondary }]}>{weekLabel}</Text>
      </Animated.View>

      <ProgressMetricsPanel layout="horizontal" metrics={metrics} loading={metricsLoading} />

      <FormCard style={{ gap: spacing.md, backgroundColor: colors.surfaceRaised }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
          <ExerciseFamilyIcon family={latest.exerciseFamily ?? "other"} size={58} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text selectable style={[typography.caption, { color: colors.textMuted, textTransform: "uppercase", letterSpacing: 0.8 }]}>Latest analysis</Text>
            <Text selectable numberOfLines={1} style={[typography.heading, { color: colors.text }]}>{latest.label}</Text>
          </View>
          <Text selectable style={[typography.title, { color: colors.gold }]}>{latest.score ?? "—"}</Text>
        </View>
        <Text selectable style={[typography.body, { color: colors.textSecondary }]}>
          {latest.status === "failed"
            ? "Retry analysis"
            : latest.priorityCorrectionTitles?.[0] ?? (latest.status === "processing" ? "Analysis in progress" : "Open your coaching review.")}
        </Text>
        <Pressable accessibilityRole="button" onPress={() => onOpenSession(latest.sessionId, latest.status)} style={{ minHeight: 44, justifyContent: "center" }}>
          <Text selectable style={[typography.label, { color: colors.gold }]}>{latest.status === "failed" ? "Retry" : "Open latest analysis  ›"}</Text>
        </Pressable>
      </FormCard>

      <View style={{ flexDirection: "row", gap: spacing.md }}>
        <Pressable accessibilityRole="button" onPress={onOpenCoach} testID="home-coach-action" style={({ pressed }) => ({ flex: 1, minHeight: 88, alignItems: "center", justifyContent: "center", gap: spacing.xs, paddingHorizontal: spacing.sm, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, opacity: pressed ? 0.7 : 1 })}>
          <DashboardIcon label="Formie Coach icon" name="coach" size={32} />
          <Text selectable numberOfLines={1} style={{ color: colors.text, fontSize: 18, lineHeight: 23, fontWeight: "600" }}>Ask Formie Coach</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={onOpenProgress} testID="home-progress-action" style={({ pressed }) => ({ flex: 1, minHeight: 88, alignItems: "center", justifyContent: "center", gap: spacing.xs, paddingHorizontal: spacing.sm, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, opacity: pressed ? 0.7 : 1 })}>
          <DashboardIcon label="View progress icon" name="progress" size={32} />
          <Text selectable numberOfLines={1} style={{ color: colors.text, fontSize: 18, lineHeight: 23, fontWeight: "600" }}>View Progress</Text>
        </Pressable>
      </View>

      <View style={{ gap: spacing.sm }}>
        <Text selectable style={[typography.caption, { color: colors.textMuted, textTransform: "uppercase", letterSpacing: 0.8 }]}>Recent sets</Text>
        {recentAnalyses.slice(0, 5).map((analysis) => (
          <Pressable accessibilityRole="button" key={analysis.sessionId} onPress={() => onOpenSession(analysis.sessionId, analysis.status)} style={({ pressed }) => ({ minHeight: 64, flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 1, borderColor: colors.border, opacity: pressed ? 0.7 : 1 })}>
            <ExerciseFamilyIcon family={analysis.exerciseFamily ?? "other"} size={48} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text selectable numberOfLines={1} style={[typography.label, { color: colors.text }]}>{analysis.label}</Text>
              <Text selectable numberOfLines={1} style={[typography.caption, { color: analysis.status === "processing" ? colors.gold : colors.textMuted }]}>
                {analysis.status === "processing"
                  ? "Analysis in progress"
                  : analysis.status === "failed"
                    ? "Retry analysis"
                    : analysis.priorityCorrectionTitles?.[0] ?? new Date(analysis.createdAt).toLocaleDateString()}
              </Text>
            </View>
            <Text selectable style={[typography.heading, { color: colors.gold }]}>{analysis.status === "processing" ? "Continue" : analysis.status === "failed" ? "Retry" : analysis.score === null ? "View" : `${analysis.score} / 100`}</Text>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}
