import { Tabs } from "expo-router";

import { ProductionIcon } from "@/components/production-icon";
import { CoachTabIcon } from "@/components/coach-tab-icon";
import { colors } from "@/theme/colors";

export default function TabsLayout() {
  return <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: colors.gold, tabBarInactiveTintColor: colors.textMuted, tabBarStyle: { height: 72, paddingTop: 6, paddingBottom: 7, backgroundColor: colors.background, borderTopColor: colors.border }, tabBarLabelStyle: { fontSize: 12, fontWeight: "600" }, tabBarItemStyle: { paddingTop: 2 }, tabBarHideOnKeyboard: true }}>
    <Tabs.Screen name="(home)" options={{ title: "Home", tabBarIcon: ({ color }) => <ProductionIcon name="tabHome" label="Home" size={30} tintColor={color} /> }} />
    <Tabs.Screen name="(coach)" options={{ title: "FORM Coach", href: "/(tabs)/(coach)", tabBarIcon: ({ color }) => <CoachTabIcon color={color} size={30} /> }} />
    <Tabs.Screen name="(progress)" options={{ title: "Progress", tabBarIcon: ({ color }) => <ProductionIcon name="tabProgress" label="Progress" size={30} tintColor={color} /> }} />
    <Tabs.Screen name="(profile)" options={{ title: "Profile", tabBarIcon: ({ color }) => <ProductionIcon name="tabProfile" label="Profile" size={30} tintColor={color} /> }} />
  </Tabs>;
}
