import { Text, View } from "react-native";

import type { VisualFocusRegion } from "@/features/analysis/result-schema";
import { colors } from "@/theme/colors";
import { radii } from "@/theme/spacing";
import { typography } from "@/theme/type";

export type FocusLayout = { width: number; height: number };

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

export function focusVideoStyle(layout: FocusLayout, focus: VisualFocusRegion, zoom = 1.7) {
  return {
    position: "absolute" as const,
    width: layout.width * zoom,
    height: layout.height * zoom,
    left: layout.width / 2 - focus.centerX * layout.width * zoom,
    top: layout.height / 2 - focus.centerY * layout.height * zoom,
  };
}

export function zoomedFocusRegion(focus: VisualFocusRegion, zoom = 1.7): VisualFocusRegion {
  return {
    ...focus,
    centerX: 0.5,
    centerY: 0.5,
    radius: Math.min(0.3, focus.radius * zoom),
    arrowFromX: clamp01(0.5 + (focus.arrowFromX - focus.centerX) * zoom),
    arrowFromY: clamp01(0.5 + (focus.arrowFromY - focus.centerY) * zoom),
  };
}

export function EvidenceFocusOverlay({ focus, layout }: { focus: VisualFocusRegion; layout: FocusLayout }) {
  const width = Math.max(1, layout.width);
  const height = Math.max(1, layout.height);
  const centerX = focus.centerX * width;
  const centerY = focus.centerY * height;
  const fromX = focus.arrowFromX * width;
  const fromY = focus.arrowFromY * height;
  const dx = centerX - fromX;
  const dy = centerY - fromY;
  const length = Math.sqrt(dx * dx + dy * dy);
  const angle = Math.atan2(dy, dx) * (180 / Math.PI);
  const diameter = Math.max(52, Math.min(width, height) * focus.radius * 2);

  return (
    <View pointerEvents="none" style={{ position: "absolute", inset: 0 }}>
      <View
        accessibilityLabel={`AI focus: ${focus.label}`}
        style={{ position: "absolute", left: centerX - diameter / 2, top: centerY - diameter / 2, width: diameter, height: diameter, borderRadius: radii.pill, borderWidth: 3, borderColor: colors.gold, backgroundColor: "rgba(200,169,107,0.08)" }}
      />
      <View
        accessibilityLabel={`Focus arrow to ${focus.label}`}
        style={{ position: "absolute", left: fromX, top: fromY - 1, width: length, height: 2, borderRadius: 1, backgroundColor: colors.gold, transformOrigin: "left center", transform: [{ rotate: `${angle}deg` }] }}
      />
      <View style={{ position: "absolute", left: centerX - 5, top: centerY - 5, width: 10, height: 10, borderRadius: 5, backgroundColor: colors.gold }} />
      <Text selectable style={[typography.caption, { position: "absolute", left: Math.max(8, Math.min(width - 96, centerX - 44)), top: Math.max(8, centerY - diameter / 2 - 28), width: 88, color: colors.gold, textAlign: "center", letterSpacing: 1.1 }]}>LOOK HERE</Text>
    </View>
  );
}
