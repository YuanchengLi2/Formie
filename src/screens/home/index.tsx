import { Image } from "expo-image";
import { Pressable, ScrollView, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

import { ExerciseFamilyIcon } from "@/components/exercise-family-icon";
import { FormCard } from "@/components/form-card";
import { FormWordmark } from "@/components/form-wordmark";
import { ProductionIcon } from "@/components/production-icon";
import type { ExerciseFamily } from "@/features/exercises/exercise-family";
import { colors } from "@/theme/colors";
import { radii, spacing } from "@/theme/spacing";
import { typography } from "@/theme/type";

const recordCard = require("../../../assets/production/home-record-card.png");

type HomeScreenProps = {
  onRecord: () => void;
  recentAnalyses?: { sessionId: string; label: string; createdAt: string; score: number | null; exerciseFamily?: ExerciseFamily | null }[];
  onOpenSession?: (sessionId: string) => void;
  onOpenProfile?: () => void;
};

export function HomeScreen({ onRecord, recentAnalyses = [], onOpenSession = () => undefined, onOpenProfile = () => undefined }: HomeScreenProps) {
  return (
    <ScrollView alwaysBounceVertical bounces overScrollMode="auto" contentInsetAdjustmentBehavior="automatic" style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ gap: spacing.lg, paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.xl }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <FormWordmark />
        <Pressable accessibilityLabel="Open profile" accessibilityRole="button" onPress={onOpenProfile} style={{ width: 36, height: 36, alignItems: "center", justifyContent: "center", borderRadius: radii.pill, borderWidth: 1, borderColor: colors.gold }}><View style={{ width: 8, height: 8, borderRadius: 4, borderWidth: 1, borderColor: colors.gold }} /><View style={{ width: 15, height: 7, marginTop: 2, borderTopLeftRadius: 8, borderTopRightRadius: 8, borderWidth: 1, borderBottomWidth: 0, borderColor: colors.gold }} /></Pressable>
      </View>

      <Animated.View entering={FadeInDown.duration(220)} style={{ gap: spacing.xs }}>
        <Text selectable style={[typography.title, { color: colors.text }]}>Ready to move better?</Text>
        <Text selectable style={[typography.body, { color: colors.textSecondary }]}>Record any movement. FORM identifies it and coaches what it can actually see.</Text>
      </Animated.View>

      <Animated.View entering={FadeInDown.duration(240).delay(45)}>
        <Pressable accessibilityRole="button" accessibilityLabel="Record an Exercise" onPress={onRecord} style={({ pressed }) => ({ height: 216, overflow: "hidden", borderRadius: radii.md, opacity: pressed ? 0.78 : 1 })}>
          <Image accessibilityLabel="Person squatting inside the FORM camera frame" source={recordCard} contentFit="cover" style={{ width: "100%", height: "100%" }} />
        </Pressable>
      </Animated.View>

      <FormCard style={{ gap: spacing.md, backgroundColor: colors.surfaceRaised }}>
        <Text selectable style={[typography.heading, { color: colors.text }]}>Made for real sets</Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}><ProductionIcon name="completeVideo" label="Whole set" size={26} tintColor={colors.gold} /><Text selectable style={[typography.body, { flex: 1, color: colors.textSecondary }]}>Recognizes unusual variations and imperfect attempts</Text></View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}><ProductionIcon name="stageVideo" label="Evidence" size={26} tintColor={colors.gold} /><Text selectable style={[typography.body, { flex: 1, color: colors.textSecondary }]}>Shows the exact moment behind each coaching point</Text></View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}><ProductionIcon name="privacyLock" label="Private" size={26} tintColor={colors.gold} /><Text selectable style={[typography.body, { flex: 1, color: colors.textSecondary }]}>Keeps every recording and analysis private</Text></View>
      </FormCard>

      <View style={{ gap: spacing.sm }}>
        <Text selectable style={[typography.caption, { color: colors.textMuted, textTransform: "uppercase", letterSpacing: 0.8 }]}>Recent</Text>
        {recentAnalyses.length === 0 ? <View style={{ gap: spacing.xs, paddingVertical: spacing.md, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border }}><Text selectable style={[typography.label, { color: colors.text }]}>Your latest coaching will appear here</Text><Text selectable style={[typography.caption, { color: colors.textSecondary }]}>Record your first set to begin.</Text></View> : recentAnalyses.map((analysis) => (
          <Pressable accessibilityRole="button" key={analysis.sessionId} onPress={() => onOpenSession(analysis.sessionId)} style={({ pressed }) => ({ minHeight: 58, flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 1, borderColor: colors.border, opacity: pressed ? 0.7 : 1 })}>
            <ExerciseFamilyIcon family={analysis.exerciseFamily ?? "other"} size={48} />
            <View style={{ flex: 1, gap: 2 }}><Text selectable numberOfLines={1} style={[typography.label, { color: colors.text }]}>{analysis.label}</Text><Text selectable style={[typography.caption, { color: colors.textMuted }]}>{new Date(analysis.createdAt).toLocaleDateString()}</Text></View>
            <Text selectable style={[typography.heading, { color: colors.gold }]}>{analysis.score === null ? "View" : `${analysis.score} / 100`}</Text>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}
