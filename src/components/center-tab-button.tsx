import type { GestureResponderEvent } from "react-native";
import { Text, View } from "react-native";
import { HapticPressable as Pressable } from "@/components/haptic-pressable";

import { colors } from "@/theme/colors";

export function CenterTabButton({
  onPress,
  label = "Record",
  accessibilityLabel = label,
  disabled = false,
  variant = "record",
}: {
  onPress: (event: GestureResponderEvent) => void;
  label?: string;
  accessibilityLabel?: string;
  disabled?: boolean;
  variant?: "record" | "quota_exhausted" | "analysis_pending" | "purchase" | "renewal_pending" | "unavailable";
}) {
  const actionDisabled = disabled || variant === "quota_exhausted";
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ disabled: actionDisabled }}
      disabled={actionDisabled}
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        alignItems: "center",
        justifyContent: "flex-start",
        opacity: actionDisabled ? 0.72 : pressed ? 0.78 : 1,
        transform: [{ scale: pressed ? 0.94 : 1 }],
      })}
    >
      <View
        testID="center-tab-circle"
        style={{
          width: 56,
          height: 56,
          marginTop: -14,
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 28,
          borderWidth: 3,
          borderColor: actionDisabled ? "#626262" : "#F7D98B",
          backgroundColor: actionDisabled ? "#353535" : colors.gold,
          boxShadow: actionDisabled ? "0 4px 16px rgba(0,0,0,0.18)" : "0 5px 22px rgba(244,181,49,0.48)",
        }}
      >
        <View testID="center-tab-lens" style={{ width: 35, height: 35, borderRadius: 18, borderWidth: 2, borderColor: actionDisabled ? "#777777" : "#F9E3A7", alignItems: "center", justifyContent: "center", overflow: "hidden", backgroundColor: colors.background }}>
          {[0, 60, 120].map((rotation) => <View key={rotation} testID="center-tab-aperture-blade" style={{ position: "absolute", width: 24, height: 5, borderRadius: 3, backgroundColor: actionDisabled ? "#777777" : colors.gold, transform: [{ rotate: `${rotation}deg` }, { translateX: 5 }] }} />)}
          <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: actionDisabled ? "#999999" : "#F8E9C3", borderWidth: 1, borderColor: actionDisabled ? "#777777" : colors.gold }} />
        </View>
      </View>
      <Text selectable={false} numberOfLines={2} style={{ marginTop: 1, color: actionDisabled ? "#888888" : colors.gold, fontSize: 11, lineHeight: 14, fontWeight: "700", textAlign: "center" }}>
        {label}
      </Text>
    </Pressable>
  );
}
