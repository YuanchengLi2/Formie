import { Tabs } from "expo-router";

import { ProductionIcon } from "@/components/production-icon";
import { colors } from "@/theme/colors";

export default function TabsLayout() {
  return <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: colors.gold, tabBarInactiveTintColor: colors.textMuted, tabBarStyle: { backgroundColor: colors.background, borderTopColor: colors.border }, tabBarLabelStyle: { fontSize: 11 }, tabBarItemStyle: { paddingTop: 6 }, tabBarHideOnKeyboard: true }}>
    <Tabs.Screen name="(home)" options={{ title: "Home", tabBarIcon: ({ color }) => <ProductionIcon name="tabHome" label="Home" size={23} tintColor={color} /> }} />
    <Tabs.Screen name="(progress)" options={{ title: "Progress", tabBarIcon: ({ color }) => <ProductionIcon name="tabProgress" label="Progress" size={23} tintColor={color} /> }} />
    <Tabs.Screen name="(profile)" options={{ title: "Profile", tabBarIcon: ({ color }) => <ProductionIcon name="tabProfile" label="Profile" size={23} tintColor={color} /> }} />
  </Tabs>;
}
