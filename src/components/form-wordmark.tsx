import { Image } from "expo-image";
import { Text, View } from "react-native";

import { colors } from "@/theme/colors";

export function FormWordmark() {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      <Image accessibilityLabel="FORM logo" contentFit="contain" source={require("../../assets/images/form-logo-mark.png")} style={{ width: 24, height: 24, borderRadius: 6 }} />
      <Text selectable style={{ color: colors.gold, fontSize: 13, fontWeight: "700", letterSpacing: 4.5 }}>
        FORM
      </Text>
    </View>
  );
}
