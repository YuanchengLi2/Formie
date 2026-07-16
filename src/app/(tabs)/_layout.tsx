import { Tabs } from "expo-router";
import { Text } from "react-native";

import { colors } from "@/theme/colors";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.gold,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.background, borderTopColor: colors.border },
        tabBarLabelStyle: { fontSize: 11 },
        tabBarItemStyle: { paddingTop: 6 },
        tabBarHideOnKeyboard: true,
      }}
    >
      <Tabs.Screen name="(home)" options={{ title: "Home", tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 22 }}>⌂</Text> }} />
      <Tabs.Screen name="(progress)" options={{ title: "Progress", tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 19 }}>▥</Text> }} />
      <Tabs.Screen name="(profile)" options={{ title: "Profile", tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 21 }}>◎</Text> }} />
    </Tabs>
  );
}
