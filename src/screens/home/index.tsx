import { Image } from "expo-image";
import { Pressable, ScrollView, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

import { ExerciseFamilyIcon } from "@/components/exercise-family-icon";
import { FormWordmark } from "@/components/form-wordmark";
import type { ExerciseFamily } from "@/features/exercises/exercise-family";
import type { AnalysisHistoryStatus } from "@/features/progress/group-sessions";
import { colors } from "@/theme/colors";
import { radii, spacing } from "@/theme/spacing";
import { typography } from "@/theme/type";

const recordCard = require("../../../assets/production/home-record-card.png");

type HomeScreenProps = {
  onRecord: () => void;
  historyResolved?: boolean;
  recentAnalyses?: { sessionId: string; status: AnalysisHistoryStatus; label: string; createdAt: string; score: number | null; exerciseFamily?: ExerciseFamily | null }[];
  onOpenSession?: (sessionId: string, status: AnalysisHistoryStatus) => void;
  onOpenProfile?: () => void;
};

function HomeHeader({ onOpenProfile }: { onOpenProfile: () => void }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
      <FormWordmark />
      <Pressable accessibilityLabel="Open profile" accessibilityRole="button" onPress={onOpenProfile} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: radii.pill, borderWidth: 1, borderColor: colors.gold }}><View style={{ width: 8, height: 8, borderRadius: 4, borderWidth: 1, borderColor: colors.gold }} /><View style={{ width: 15, height: 7, marginTop: 2, borderTopLeftRadius: 8, borderTopRightRadius: 8, borderWidth: 1, borderBottomWidth: 0, borderColor: colors.gold }} /></Pressable>
    </View>
  );
}

export function HomeScreen({ onRecord, historyResolved = true, recentAnalyses = [], onOpenSession = () => undefined, onOpenProfile = () => undefined }: HomeScreenProps) {
  if (!historyResolved) {
    return (
      <View accessibilityLabel="Loading recording history" style={{ flex: 1, gap: spacing.lg, padding: spacing.lg, backgroundColor: colors.background }}>
        <HomeHeader onOpenProfile={onOpenProfile} />
        <View style={{ flex: 1, justifyContent: "center", gap: spacing.md, opacity: 0.52 }}>
          <View style={{ width: "72%", height: 38, borderRadius: radii.sm, backgroundColor: colors.surfaceRaised }} />
          <View style={{ width: "92%", height: 300, borderRadius: radii.lg, backgroundColor: colors.surface }} />
        </View>
      </View>
    );
  }

  if (recentAnalyses.length === 0) {
    return (
      <ScrollView
        accessibilityLabel="First recording hero"
        alwaysBounceVertical
        bounces
        overScrollMode="auto"
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={{ flexGrow: 1, gap: spacing.lg, padding: spacing.lg, paddingBottom: spacing.xl }}
      >
        <HomeHeader onOpenProfile={onOpenProfile} />
        <View style={{ flex: 1, justifyContent: "center", gap: spacing.xl }}>
          <Animated.View entering={FadeInDown.duration(220)} style={{ gap: spacing.sm }}>
            <Text selectable style={[typography.title, { color: colors.text }]}>Ready to move better?</Text>
            <Text selectable style={[typography.body, { maxWidth: 330, color: colors.textSecondary }]}>Record a set. Get clear coaching on what changed.</Text>
          </Animated.View>
          <Animated.View entering={FadeInDown.duration(260).delay(45)}>
            <Pressable accessibilityRole="button" accessibilityLabel="Record an Exercise" onPress={onRecord} style={({ pressed }) => ({ height: 390, overflow: "hidden", borderRadius: radii.lg, borderWidth: 1, borderColor: colors.border, opacity: pressed ? 0.78 : 1 })}>
              <Image accessibilityLabel="Person squatting inside the FORM camera frame" source={recordCard} contentFit="cover" style={{ width: "100%", height: "100%" }} />
              <View style={{ position: "absolute", left: spacing.lg, right: spacing.lg, bottom: spacing.lg, minHeight: 52, alignItems: "center", justifyContent: "center", borderRadius: radii.pill, backgroundColor: colors.gold }}>
                <Text style={[typography.label, { color: colors.background }]}>Record your first set</Text>
              </View>
            </Pressable>
          </Animated.View>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView alwaysBounceVertical bounces overScrollMode="auto" contentInsetAdjustmentBehavior="automatic" style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ gap: spacing.lg, paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.xl }}>
      <HomeHeader onOpenProfile={onOpenProfile} />

      <Animated.View entering={FadeInDown.duration(220)} style={{ gap: spacing.xs }}>
        <Text selectable style={[typography.title, { color: colors.text }]}>Ready to move better?</Text>
        <Text selectable style={[typography.body, { color: colors.textSecondary }]}>Record a set. Get clear coaching on what changed.</Text>
      </Animated.View>

      <Animated.View entering={FadeInDown.duration(240).delay(45)}>
        <Pressable accessibilityRole="button" accessibilityLabel="Record an Exercise" onPress={onRecord} style={({ pressed }) => ({ height: 250, overflow: "hidden", borderRadius: radii.md, opacity: pressed ? 0.78 : 1 })}>
          <Image accessibilityLabel="Person squatting inside the FORM camera frame" source={recordCard} contentFit="cover" style={{ width: "100%", height: "100%" }} />
        </Pressable>
      </Animated.View>

      <View style={{ gap: spacing.sm }}>
        <Text selectable style={[typography.caption, { color: colors.textMuted, textTransform: "uppercase", letterSpacing: 0.8 }]}>Recent</Text>
        {recentAnalyses.map((analysis) => (
          <Pressable accessibilityRole="button" key={analysis.sessionId} onPress={() => onOpenSession(analysis.sessionId, analysis.status)} style={({ pressed }) => ({ minHeight: 58, flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 1, borderColor: colors.border, opacity: pressed ? 0.7 : 1 })}>
            <ExerciseFamilyIcon family={analysis.exerciseFamily ?? "other"} size={48} />
            <View style={{ flex: 1, gap: 2 }}><Text selectable numberOfLines={1} style={[typography.label, { color: colors.text }]}>{analysis.label}</Text><Text selectable style={[typography.caption, { color: analysis.status === "processing" ? colors.gold : colors.textMuted }]}>{analysis.status === "processing" ? "Analysis in progress" : new Date(analysis.createdAt).toLocaleDateString()}</Text></View>
            <Text selectable style={[typography.heading, { color: colors.gold }]}>{analysis.status === "processing" ? "Continue" : analysis.score === null ? "View" : `${analysis.score} / 100`}</Text>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}
