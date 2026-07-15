import { Pressable, ScrollView, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

import { FormButton } from "@/components/form-button";
import { FormCard } from "@/components/form-card";
import { FormWordmark } from "@/components/form-wordmark";
import { colors } from "@/theme/colors";
import { radii, spacing } from "@/theme/spacing";
import { typography } from "@/theme/type";

type HomeScreenProps = {
  onRecord: () => void;
  recentAnalyses?: { sessionId: string; label: string; createdAt: string; score: number | null }[];
  onOpenSession?: (sessionId: string) => void;
};

const STEPS = [
  ["1", "Record", "Capture one working set from any useful angle."],
  ["2", "Understand", "FORM identifies the movement and reviews every visible rep."],
  ["3", "Correct", "See evidence-backed strengths, corrections, and cues."],
] as const;

export function HomeScreen({ onRecord, recentAnalyses = [], onOpenSession = () => undefined }: HomeScreenProps) {
  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ gap: spacing.xl, paddingHorizontal: spacing.lg, paddingTop: spacing.xxl, paddingBottom: 120 }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <FormWordmark />
        <View
          style={{
            width: 36,
            height: 36,
            alignItems: "center",
            justifyContent: "center",
            borderRadius: radii.pill,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surface,
          }}
        >
          <Text selectable style={{ color: colors.gold, fontSize: 14 }}>●</Text>
        </View>
      </View>

      <Animated.View entering={FadeInDown.duration(240)} style={{ gap: spacing.sm }}>
        <Text selectable style={[typography.title, { color: colors.text, maxWidth: 300 }]}>Ready to move better?</Text>
        <Text selectable style={[typography.body, { color: colors.textSecondary, maxWidth: 340 }]}>
          Record any movement. FORM identifies it and coaches what it can actually see.
        </Text>
      </Animated.View>

      <Animated.View entering={FadeInDown.duration(240).delay(60)}>
        <FormCard style={{ gap: spacing.xl, padding: spacing.xl, backgroundColor: colors.surfaceRaised }}>
          <View style={{ height: 176, alignItems: "center", justifyContent: "center" }}>
            <View
              style={{
                width: 126,
                height: 126,
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 63,
                borderWidth: 1,
                borderColor: colors.gold,
                backgroundColor: colors.goldSoft,
              }}
            >
              <View
                style={{
                  width: 74,
                  height: 74,
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 37,
                  borderWidth: 2,
                  borderColor: colors.gold,
                }}
              >
                <Text selectable style={{ color: colors.gold, fontSize: 30 }}>●</Text>
              </View>
            </View>
          </View>
          <View style={{ gap: spacing.sm }}>
            <Text selectable style={[typography.heading, { color: colors.text, textAlign: "center" }]}>Your set. Your camera. Real feedback.</Text>
            <Text selectable style={[typography.caption, { color: colors.textSecondary, textAlign: "center" }]}>No exercise selection or perfect setup required.</Text>
          </View>
          <FormButton label="Record an Exercise" onPress={onRecord} />
        </FormCard>
      </Animated.View>

      <View style={{ gap: spacing.md }}>
        <Text selectable style={[typography.heading, { color: colors.text }]}>How FORM works</Text>
        {STEPS.map(([number, title, detail]) => (
          <View key={number} style={{ flexDirection: "row", gap: spacing.md, alignItems: "flex-start" }}>
            <View
              style={{
                width: 30,
                height: 30,
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 15,
                backgroundColor: colors.goldSoft,
              }}
            >
              <Text selectable style={[typography.label, { color: colors.gold }]}>{number}</Text>
            </View>
            <View style={{ flex: 1, gap: spacing.xs }}>
              <Text selectable style={[typography.label, { color: colors.text }]}>{title}</Text>
              <Text selectable style={[typography.caption, { color: colors.textSecondary }]}>{detail}</Text>
            </View>
          </View>
        ))}
      </View>

      <View style={{ gap: spacing.md }}>
        <Text selectable style={[typography.heading, { color: colors.text }]}>Recent Analyses</Text>
        {recentAnalyses.length === 0 ? (
          <FormCard>
            <Text selectable style={[typography.label, { color: colors.text }]}>Your latest coaching will appear here</Text>
            <Text selectable style={[typography.caption, { color: colors.textSecondary }]}>Record your first set to start building movement history automatically.</Text>
          </FormCard>
        ) : recentAnalyses.map((analysis) => (
          <Pressable accessibilityRole="button" key={analysis.sessionId} onPress={() => onOpenSession(analysis.sessionId)}>
            <FormCard style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <View style={{ flex: 1, gap: spacing.xs }}>
                <Text selectable style={[typography.label, { color: colors.text }]}>{analysis.label}</Text>
                <Text selectable style={[typography.caption, { color: colors.textMuted }]}>{new Date(analysis.createdAt).toLocaleDateString()}</Text>
              </View>
              <Text selectable style={[typography.label, { color: colors.gold }]}>{analysis.score === null ? "View" : `${analysis.score} / 100`}</Text>
            </FormCard>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}
