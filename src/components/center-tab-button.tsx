import type { GestureResponderEvent } from "react-native";
import { Pressable, Text, View } from "react-native";

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
  const exhausted = variant === "quota_exhausted";
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        alignItems: "center",
        justifyContent: "flex-start",
        opacity: disabled ? 0.48 : pressed ? 0.78 : 1,
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
          borderColor: "#F7D98B",
          backgroundColor: exhausted ? colors.goldSoft : colors.gold,
          boxShadow: exhausted ? "0 4px 16px rgba(216,166,48,0.2)" : "0 5px 22px rgba(244,181,49,0.48)",
        }}
      >
        <View testID="center-tab-lens" style={{ width: 35, height: 35, borderRadius: 18, borderWidth: 2, borderColor: "#F9E3A7", alignItems: "center", justifyContent: "center", overflow: "hidden", backgroundColor: colors.background }}>
          {[0, 60, 120].map((rotation) => <View key={rotation} testID="center-tab-aperture-blade" style={{ position: "absolute", width: 24, height: 5, borderRadius: 3, backgroundColor: colors.gold, transform: [{ rotate: `${rotation}deg` }, { translateX: 5 }] }} />)}
          <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: "#F8E9C3", borderWidth: 1, borderColor: colors.gold }} />
        </View>
      </View>
      <Text selectable={false} style={{ marginTop: 1, color: colors.gold, fontSize: 11, lineHeight: 14, fontWeight: "700" }}>
        {label}
      </Text>
    </Pressable>
  );
}
