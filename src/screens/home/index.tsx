import { Pressable, ScrollView, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

import { FormButton } from "@/components/form-button";
import { FormCard } from "@/components/form-card";
import { FormWordmark } from "@/components/form-wordmark";
import { MovementFrame } from "@/components/movement-frame";
import { colors } from "@/theme/colors";
import { radii, spacing } from "@/theme/spacing";
import { typography } from "@/theme/type";

type HomeScreenProps = {
  onRecord: () => void;
  recentAnalyses?: { sessionId: string; label: string; createdAt: string; score: number | null }[];
  onOpenSession?: (sessionId: string) => void;
  onOpenProfile?: () => void;
};

export function HomeScreen({ onRecord, recentAnalyses = [], onOpenSession = () => undefined, onOpenProfile = () => undefined }: HomeScreenProps) {
  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ gap: spacing.xl, paddingHorizontal: spacing.lg, paddingTop: spacing.xl, paddingBottom: 112 }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <FormWordmark />
        <Pressable accessibilityLabel="Open profile" accessibilityRole="button" onPress={onOpenProfile} style={{ width: 32, height: 32, alignItems: "center", justifyContent: "center", borderRadius: radii.pill, borderWidth: 1, borderColor: colors.gold }}>
          <View style={{ width: 7, height: 7, borderRadius: 4, borderWidth: 1, borderColor: colors.gold }} />
          <View style={{ width: 13, height: 6, marginTop: 2, borderTopLeftRadius: 7, borderTopRightRadius: 7, borderWidth: 1, borderBottomWidth: 0, borderColor: colors.gold }} />
        </Pressable>
      </View>

      <Animated.View entering={FadeInDown.duration(220)} style={{ gap: spacing.sm }}>
        <Text selectable style={[typography.title, { color: colors.text, maxWidth: 310 }]}>Ready to{`\n`}move better?</Text>
        <Text selectable style={[typography.body, { color: colors.textSecondary }]}>Record any movement. FORM identifies it and coaches what it can actually see.</Text>
      </Animated.View>

      <Animated.View entering={FadeInDown.duration(240).delay(45)}>
        <FormCard style={{ gap: spacing.lg, padding: spacing.lg, backgroundColor: colors.surfaceRaised }}>
          <MovementFrame height={178} />
          <FormButton label="Record an Exercise" onPress={onRecord} />
        </FormCard>
      </Animated.View>

      <View style={{ gap: spacing.md }}>
        <Text selectable style={[typography.caption, { color: colors.textMuted, textTransform: "uppercase", letterSpacing: 0.8 }]}>Recent</Text>
        {recentAnalyses.length === 0 ? (
          <View style={{ gap: spacing.xs, paddingVertical: spacing.md, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border }}>
            <Text selectable style={[typography.label, { color: colors.text }]}>Your latest coaching will appear here</Text>
            <Text selectable style={[typography.caption, { color: colors.textSecondary }]}>Record your first set to start building movement history automatically.</Text>
          </View>
        ) : recentAnalyses.map((analysis) => (
          <Pressable
            accessibilityRole="button"
            key={analysis.sessionId}
            onPress={() => onOpenSession(analysis.sessionId)}
            style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md, borderBottomWidth: 1, borderColor: colors.border, opacity: pressed ? 0.7 : 1 })}
          >
            <MovementFrame height={48} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text selectable style={[typography.label, { color: colors.text }]}>{analysis.label}</Text>
              <Text selectable style={[typography.caption, { color: colors.textMuted }]}>{new Date(analysis.createdAt).toLocaleDateString()}</Text>
            </View>
            <Text selectable style={[typography.heading, { color: colors.gold }]}>{analysis.score === null ? "View" : `${analysis.score} / 100`}</Text>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}
