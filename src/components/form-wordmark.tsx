import { Text } from "react-native";

import { colors } from "@/theme/colors";

export function FormWordmark() {
  return (
    <Text selectable style={{ color: colors.gold, fontSize: 17, fontStyle: "italic", fontWeight: "800", letterSpacing: 1.1 }}>
      FORM
    </Text>
  );
}
