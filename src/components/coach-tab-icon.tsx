import { View } from "react-native";

export function CoachTabIcon({ color, size = 30 }: { color: string; size?: number }) {
  return (
    <View accessibilityLabel="Coach" style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <View style={{ width: size * 0.78, height: size * 0.58, borderRadius: size * 0.18, borderWidth: 2, borderColor: color }} />
      <View style={{ position: "absolute", left: size * 0.25, bottom: size * 0.13, width: size * 0.2, height: size * 0.2, borderLeftWidth: 2, borderBottomWidth: 2, borderColor: color, transform: [{ rotate: "-35deg" }] }} />
      <View style={{ position: "absolute", top: size * 0.42, flexDirection: "row", gap: 3 }}><View style={{ width: 3, height: 3, borderRadius: 2, backgroundColor: color }} /><View style={{ width: 3, height: 3, borderRadius: 2, backgroundColor: color }} /><View style={{ width: 3, height: 3, borderRadius: 2, backgroundColor: color }} /></View>
    </View>
  );
}
