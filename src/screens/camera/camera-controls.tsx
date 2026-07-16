import { Pressable, Text, View } from "react-native";

import { FormButton } from "@/components/form-button";
import { formatElapsed } from "@/features/capture/countdown";
import type { CapturePhase } from "@/features/capture/types";
import { colors } from "@/theme/colors";
import { radii, spacing } from "@/theme/spacing";
import { typography } from "@/theme/type";

const MIN_RECORDING_MS = 3_000;

type CameraControlsProps = {
  phase: CapturePhase;
  countdown: number | null;
  elapsedMs: number;
  error: string | null;
  hasRecording: boolean;
  onRecord: () => void;
  onStop: () => void;
  onRetryUpload: () => void;
  onDiscardRecording?: () => void;
};

export function CameraControls({
  phase,
  countdown,
  elapsedMs,
  error,
  hasRecording,
  onRecord,
  onStop,
  onRetryUpload,
  onDiscardRecording = () => undefined,
}: CameraControlsProps) {
  return (
    <View pointerEvents="box-none" style={{ position: "absolute", inset: 0, justifyContent: "space-between", padding: spacing.xl }}>
      <View style={{ alignItems: "center", paddingTop: spacing.xxl }}>
        {phase === "recording" ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radii.pill, backgroundColor: "rgba(0,0,0,0.64)" }}>
            <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: colors.danger }} />
            <Text selectable style={[typography.label, { color: colors.text, fontVariant: ["tabular-nums"] }]}>{formatElapsed(elapsedMs)}</Text>
          </View>
        ) : null}
      </View>

      {phase === "countingDown" ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.md }}>
          <Text selectable style={{ color: colors.text, fontSize: 112, lineHeight: 120, fontWeight: "200", fontVariant: ["tabular-nums"] }}>{countdown}</Text>
          <Text selectable style={[typography.body, { color: colors.text }]}>Recording starts automatically</Text>
        </View>
      ) : (
        <View style={{ flex: 1 }} />
      )}

      <View style={{ alignItems: "center", gap: spacing.md, paddingBottom: spacing.xl }}>
        {phase === "idle" || phase === "processing" ? (
          <Pressable
            accessibilityLabel="Start countdown"
            accessibilityRole="button"
            onPress={onRecord}
            style={({ pressed }) => ({
              width: 82,
              height: 82,
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 41,
              borderWidth: 2,
              borderColor: colors.text,
              opacity: pressed ? 0.72 : 1,
            })}
          >
            <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: colors.danger }} />
          </Pressable>
        ) : null}

        {phase === "recording" ? (
          <>
            <Pressable
              accessibilityLabel="Stop recording"
              accessibilityRole="button"
              accessibilityState={{ disabled: elapsedMs < MIN_RECORDING_MS }}
              disabled={elapsedMs < MIN_RECORDING_MS}
              onPress={onStop}
              style={{ width: 82, height: 82, alignItems: "center", justifyContent: "center", borderRadius: 41, borderWidth: 2, borderColor: colors.gold, opacity: elapsedMs < MIN_RECORDING_MS ? 0.5 : 1 }}
            >
              <View style={{ width: 34, height: 34, borderRadius: 6, backgroundColor: colors.text }} />
            </Pressable>
            {elapsedMs < MIN_RECORDING_MS ? <Text selectable style={[typography.caption, { color: colors.text }]}>Keep recording for 3 seconds</Text> : null}
          </>
        ) : null}

        {phase === "recorded" || phase === "uploading" ? (
          <View style={{ paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderRadius: radii.pill, backgroundColor: "rgba(0,0,0,0.72)" }}>
            <Text selectable style={[typography.label, { color: colors.text }]}>{phase === "uploading" ? "Uploading original video…" : "Preparing upload…"}</Text>
          </View>
        ) : null}

        {phase === "error" ? (
          <View style={{ width: "100%", gap: spacing.md, padding: spacing.lg, borderRadius: radii.md, backgroundColor: "rgba(9,9,9,0.92)" }}>
            <Text selectable style={[typography.body, { color: colors.text }]}>{error}</Text>
            {hasRecording ? (
              <Text selectable style={[typography.caption, { color: colors.textSecondary }]}>Your recording is still saved on this device.</Text>
            ) : (
              <Text selectable style={[typography.caption, { color: colors.textSecondary }]}>Nothing was uploaded. You can safely try again.</Text>
            )}
            <FormButton label={hasRecording ? "Retry Upload" : "Record Again"} onPress={hasRecording ? onRetryUpload : onRecord} />
            {hasRecording ? <FormButton label="Discard and Record Again" variant="ghost" onPress={onDiscardRecording} /> : null}
          </View>
        ) : null}
      </View>
    </View>
  );
}
