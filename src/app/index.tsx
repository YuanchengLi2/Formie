import { Text, View } from "react-native";

export default function IndexRoute() {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#090909" }}>
      <Text selectable style={{ color: "#D8B45A", fontSize: 24, fontWeight: "700" }}>
        FORM
      </Text>
    </View>
  );
}
