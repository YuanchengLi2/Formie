import { Text, View } from "react-native";
import { HapticPressable as Pressable } from "@/components/haptic-pressable";

import { FormButton } from "@/components/form-button";
import { formatElapsed } from "@/features/capture/countdown";
import type { CameraZoomLabel } from "@/features/capture/camera-zoom";
import type { CapturePhase } from "@/features/capture/types";
import { captureVideoSettings } from "@/features/capture/video-settings";
import { colors } from "@/theme/colors";
import { radii, spacing } from "@/theme/spacing";
import { typography } from "@/theme/type";

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
  zoomed?: boolean;
  onResetZoom?: () => void;
  zoomPresets?: CameraZoomLabel[];
  activeZoomLabel?: CameraZoomLabel | null;
  onSelectZoom?: (label: CameraZoomLabel) => void;
  topInset?: number;
  bottomInset?: number;
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
  zoomed = false,
  onResetZoom = () => undefined,
  zoomPresets = [],
  activeZoomLabel = null,
  onSelectZoom = () => undefined,
  topInset = 0,
  bottomInset = 0,
}: CameraControlsProps) {
  return (
    <View pointerEvents="box-none" style={{ position: "absolute", inset: 0, justifyContent: "space-between", padding: spacing.xl }}>
      <View style={{ alignItems: "center", paddingTop: topInset + 76 }}>
        {phase === "recording" ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radii.pill, backgroundColor: "rgba(0,0,0,0.64)" }}>
            <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: colors.danger }} />
            <Text selectable style={[typography.label, { color: colors.text, fontVariant: ["tabular-nums"] }]}>{formatElapsed(elapsedMs)}</Text>
          </View>
        ) : null}
      </View>

      {phase === "countingDown" ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.md }}>
          <View style={{ width: 220, height: 220, alignItems: "center", justifyContent: "center", borderRadius: 110, borderWidth: 2, borderColor: colors.gold, backgroundColor: "rgba(0,0,0,0.24)" }}>
            <Text selectable style={{ color: colors.text, fontSize: 104, lineHeight: 112, fontWeight: "200", fontVariant: ["tabular-nums"] }}>{countdown}</Text>
          </View>
          <Text selectable style={[typography.heading, { color: colors.text }]}>Get into position</Text>
          <Text selectable style={[typography.caption, { color: colors.textSecondary }]}>Recording starts automatically</Text>
        </View>
      ) : (
        <View style={{ flex: 1 }} />
      )}

      <View style={{ alignItems: "center", gap: spacing.md, paddingBottom: bottomInset + spacing.md }}>
        {phase === "idle" || phase === "processing" ? (
          <>
            <View accessibilityLabel="Camera zoom presets" style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: 4, borderRadius: radii.pill, backgroundColor: "rgba(0,0,0,0.62)" }}>
              {zoomPresets.map((label) => {
                const selected = activeZoomLabel === label;
                return (
                  <Pressable
                    key={label}
                    accessibilityLabel={`Camera zoom ${label}`}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    onPress={() => onSelectZoom(label)}
                    style={({ pressed }) => ({ minWidth: 48, minHeight: 40, alignItems: "center", justifyContent: "center", borderRadius: radii.pill, backgroundColor: selected ? colors.gold : "transparent", opacity: pressed ? 0.72 : 1 })}
                  >
                    <Text style={[typography.label, { color: selected ? colors.background : colors.text }]}>{label}</Text>
                  </Pressable>
                );
              })}
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radii.pill, backgroundColor: "rgba(0,0,0,0.58)" }}>
              <Text selectable style={[typography.caption, { color: colors.text }]}>Keep the full movement visible</Text>
              {zoomed ? <Pressable accessibilityLabel="Reset zoom to 1x" accessibilityRole="button" onPress={onResetZoom} hitSlop={10}><Text style={[typography.label, { color: colors.gold }]}>Reset to 1×</Text></Pressable> : null}
            </View>
            <Pressable
              accessibilityLabel="Start countdown"
              accessibilityRole="button"
              onPress={onRecord}
              style={({ pressed }) => ({ width: 82, height: 82, alignItems: "center", justifyContent: "center", borderRadius: 41, borderWidth: 2, borderColor: colors.text, opacity: pressed ? 0.72 : 1, transform: [{ scale: pressed ? 0.96 : 1 }] })}
            >
              <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: colors.danger }} />
            </Pressable>
          </>
        ) : null}

        {phase === "recording" ? (
          <>
            <Pressable
              accessibilityLabel="Stop recording"
              accessibilityRole="button"
              accessibilityState={{ disabled: elapsedMs < captureVideoSettings.minimumDurationMs }}
              disabled={elapsedMs < captureVideoSettings.minimumDurationMs}
              onPress={onStop}
              style={{ width: 82, height: 82, alignItems: "center", justifyContent: "center", borderRadius: 41, borderWidth: 2, borderColor: colors.gold, opacity: elapsedMs < captureVideoSettings.minimumDurationMs ? 0.5 : 1 }}
            >
              <View style={{ width: 34, height: 34, borderRadius: 6, backgroundColor: colors.text }} />
            </Pressable>
            {elapsedMs < captureVideoSettings.minimumDurationMs ? <Text selectable style={[typography.caption, { color: colors.text }]}>Keep recording for 3 seconds</Text> : null}
            {elapsedMs >= captureVideoSettings.minimumDurationMs ? <Text selectable style={[typography.caption, { color: colors.textSecondary }]}>Tap to stop</Text> : null}
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
