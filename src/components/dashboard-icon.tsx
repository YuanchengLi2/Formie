import { View } from "react-native";

import { colors } from "@/theme/colors";

export type DashboardIconName = "coach" | "progress" | "streak" | "average" | "best" | "improvement";

type DashboardIconProps = {
  name: DashboardIconName;
  label: string;
  size?: number;
};

function Bars({ size }: { size: number }) {
  return (
    <View style={{ width: size * 0.68, height: size * 0.62, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" }}>
      {[0.42, 0.68, 1].map((height, index) => (
        <View key={height} style={{ width: size * 0.13, height: size * 0.5 * height, borderRadius: size * 0.05, backgroundColor: colors.gold, transform: [{ translateY: index === 1 ? -1 : 0 }] }} />
      ))}
    </View>
  );
}

export function DashboardIcon({ name, label, size = 32 }: DashboardIconProps) {
  let icon;
  if (name === "coach") {
    icon = (
      <View style={{ width: size * 0.68, height: size * 0.5, borderRadius: size * 0.16, borderWidth: 2, borderColor: colors.gold, justifyContent: "center", paddingHorizontal: size * 0.13 }}>
        <View style={{ width: "72%", height: 2, borderRadius: 1, backgroundColor: colors.gold }} />
        <View style={{ width: "48%", height: 2, marginTop: size * 0.1, borderRadius: 1, backgroundColor: colors.gold }} />
        <View style={{ position: "absolute", left: size * 0.1, bottom: -size * 0.13, width: size * 0.18, height: size * 0.18, borderLeftWidth: 2, borderBottomWidth: 2, borderColor: colors.gold, transform: [{ rotate: "-35deg" }] }} />
      </View>
    );
  } else if (name === "progress" || name === "average") {
    icon = <Bars size={size} />;
  } else if (name === "streak") {
    icon = (
      <View style={{ width: size * 0.48, height: size * 0.62, borderTopLeftRadius: size * 0.34, borderTopRightRadius: size * 0.16, borderBottomLeftRadius: size * 0.28, borderBottomRightRadius: size * 0.3, borderWidth: 2, borderColor: colors.gold, transform: [{ rotate: "8deg" }], alignItems: "center", justifyContent: "flex-end", paddingBottom: size * 0.08 }}>
        <View style={{ width: size * 0.16, height: size * 0.22, borderRadius: size * 0.1, backgroundColor: colors.gold }} />
      </View>
    );
  } else if (name === "best") {
    icon = (
      <View style={{ width: size * 0.72, height: size * 0.68, alignItems: "center" }}>
        <View style={{ width: size * 0.44, height: size * 0.36, borderBottomLeftRadius: size * 0.22, borderBottomRightRadius: size * 0.22, borderWidth: 2, borderTopWidth: 0, borderColor: colors.gold }} />
        <View style={{ position: "absolute", top: size * 0.04, left: 0, width: size * 0.19, height: size * 0.24, borderWidth: 2, borderRightWidth: 0, borderColor: colors.gold, borderTopLeftRadius: size * 0.12, borderBottomLeftRadius: size * 0.12 }} />
        <View style={{ position: "absolute", top: size * 0.04, right: 0, width: size * 0.19, height: size * 0.24, borderWidth: 2, borderLeftWidth: 0, borderColor: colors.gold, borderTopRightRadius: size * 0.12, borderBottomRightRadius: size * 0.12 }} />
        <View style={{ width: 2, height: size * 0.16, backgroundColor: colors.gold }} />
        <View style={{ width: size * 0.4, height: 2, borderRadius: 1, backgroundColor: colors.gold }} />
      </View>
    );
  } else {
    icon = (
      <View style={{ width: size * 0.68, height: size * 0.68 }}>
        <View style={{ position: "absolute", left: size * 0.08, bottom: size * 0.12, width: size * 0.56, height: 2, borderRadius: 1, backgroundColor: colors.gold, transform: [{ rotate: "-43deg" }] }} />
        <View style={{ position: "absolute", right: size * 0.02, top: size * 0.04, width: size * 0.24, height: size * 0.24, borderTopWidth: 2, borderRightWidth: 2, borderColor: colors.gold }} />
      </View>
    );
  }

  return (
    <View accessibilityLabel={label} style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      {icon}
    </View>
  );
}
