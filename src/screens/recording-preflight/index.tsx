import { ActivityIndicator, Text, View } from "react-native";
import { HapticPressable as Pressable } from "@/components/haptic-pressable";
import { VideoView, useVideoPlayer } from "expo-video";

import { FormButton } from "@/components/form-button";
import { ProductionIcon } from "@/components/production-icon";
import { ResponsiveScreen } from "@/components/responsive-screen";
import type { RecordingPreflightGuidance } from "@/features/capture/types";
import { colors } from "@/theme/colors";
import { radii, spacing } from "@/theme/spacing";
import { typography } from "@/theme/type";
import { usePhoneLayoutProfile } from "@/theme/responsive";

type RecordingPreflightScreenProps =
  | { mode: "checking"; onBack: () => void }
  | {
      mode: "advisory";
      localVideoUri: string;
      reason?: string | null;
      guidance: RecordingPreflightGuidance;
      onBack: () => void;
      onContinue: () => void;
      onRetake?: () => void;
    };

function RecordingIssueVideo({ height, localVideoUri }: { height: number; localVideoUri: string }) {
  const player = useVideoPlayer(localVideoUri, (created) => {
    created.loop = true;
    created.muted = true;
    created.play();
  });

  return (
    <View style={{ width: "100%", height, overflow: "hidden", borderRadius: radii.lg, borderCurve: "continuous", backgroundColor: colors.cameraBlack }}>
      <VideoView
        accessibilityLabel="Recording tips preview"
        contentFit="contain"
        fullscreenOptions={{ enable: true }}
        nativeControls
        player={player}
        style={{ width: "100%", height: "100%" }}
      />
    </View>
  );
}

export function RecordingPreflightScreen(props: RecordingPreflightScreenProps) {
  const layout = usePhoneLayoutProfile();
  return (
    <ResponsiveScreen testID="recording-preflight-responsive-screen" contentContainerStyle={{ gap: spacing.lg, paddingTop: spacing.sm }}>
      <Pressable
        accessibilityLabel="Back"
        accessibilityRole="button"
        onPress={props.onBack}
        style={({ pressed }) => ({
          minHeight: 44,
          alignSelf: "flex-start",
          justifyContent: "center",
          paddingHorizontal: spacing.sm,
          borderRadius: radii.sm,
          backgroundColor: pressed ? colors.surfaceRaised : "transparent",
        })}
      >
        <Text selectable style={[typography.label, { color: colors.gold }]}>Back</Text>
      </Pressable>

      {props.mode === "checking" ? (
        <View style={{ flex: 1, minHeight: 420, alignItems: "center", justifyContent: "center", gap: spacing.xl }}>
          <ActivityIndicator accessibilityLabel="Checking recording" color={colors.gold} size="large" />
          <Text selectable style={[typography.title, { color: colors.text, textAlign: "center" }]}>Checking your recording</Text>
        </View>
      ) : (
        <View style={{ width: "100%", maxWidth: 520, alignSelf: "center", gap: spacing.xl }}>
          <View style={{ alignItems: "center", gap: spacing.md }}>
            <View style={{ width: 72, height: 72, alignItems: "center", justifyContent: "center", borderRadius: 36, backgroundColor: colors.goldSoft }}>
              <ProductionIcon name="warning" label="Recording tips" size={40} tintColor={colors.gold} />
            </View>
            <Text selectable style={[typography.title, { color: colors.text, textAlign: "center" }]}>A few recording tips</Text>
            <Text selectable style={[typography.body, { color: colors.textSecondary, textAlign: "center" }]}>These suggestions improve visual evidence, but they never block analysis.</Text>
          </View>

          <RecordingIssueVideo height={layout.short ? 180 : 220} localVideoUri={props.localVideoUri} />

          <View style={{ gap: spacing.md, padding: spacing.lg, borderRadius: radii.lg, borderCurve: "continuous", backgroundColor: colors.surface }}>
            {props.reason ? <Text selectable style={[typography.body, { color: colors.textSecondary }]}>{props.reason}</Text> : null}
            <View style={{ gap: spacing.xs }}>
              <Text selectable style={[typography.label, { color: colors.text }]}>Place your phone</Text>
              <Text selectable style={[typography.body, { color: colors.textSecondary }]}>{props.guidance.phoneSetup}</Text>
            </View>
            <View style={{ gap: spacing.xs }}>
              <Text selectable style={[typography.label, { color: colors.text }]}>Frame the movement</Text>
              <Text selectable style={[typography.body, { color: colors.textSecondary }]}>{props.guidance.positioning}</Text>
            </View>
            <View style={{ gap: spacing.xs }}>
              <Text selectable style={[typography.label, { color: colors.text }]}>Keep visible</Text>
              <Text selectable style={[typography.body, { color: colors.textSecondary }]}>{props.guidance.visibilityTarget}</Text>
            </View>
          </View>
          <View style={{ gap: spacing.md }}>
            <FormButton label="Continue with recording" onPress={props.onContinue} />
            {props.onRetake ? <FormButton label="Record another set" variant="secondary" onPress={props.onRetake} /> : null}
          </View>
        </View>
      )}
    </ResponsiveScreen>
  );
}
