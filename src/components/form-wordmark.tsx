import { Text } from "react-native";

import { colors } from "@/theme/colors";

export function FormWordmark() {
  return (
    <Text selectable style={{ color: colors.gold, fontSize: 13, fontWeight: "700", letterSpacing: 4.5 }}>
      FORM
    </Text>
  );
}
