import type { GestureResponderEvent } from "react-native";
import { Pressable, Text, View } from "react-native";

import { colors } from "@/theme/colors";

export function CenterTabButton({
  onPress,
}: {
  onPress: (event: GestureResponderEvent) => void;
}) {
  return (
    <Pressable
      accessibilityLabel="Record"
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        alignItems: "center",
        justifyContent: "flex-start",
        opacity: pressed ? 0.78 : 1,
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
          borderColor: colors.background,
          backgroundColor: colors.gold,
          boxShadow: "0 5px 18px rgba(200,169,107,0.32)",
        }}
      >
        <Text selectable={false} style={{ color: colors.background, fontSize: 20, lineHeight: 23, fontWeight: "900" }}>
          ●
        </Text>
      </View>
      <Text selectable={false} style={{ marginTop: 1, color: colors.gold, fontSize: 11, lineHeight: 14, fontWeight: "700" }}>
        Record
      </Text>
    </Pressable>
  );
}
