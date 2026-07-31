import { Tabs, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CenterTabButton } from "@/components/center-tab-button";
import { CoachTabIcon } from "@/components/coach-tab-icon";
import { ProductionIcon } from "@/components/production-icon";
import { colors } from "@/theme/colors";

export default function TabsLayout() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const bottomPadding = Math.max(insets.bottom, 10);
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: true,
        tabBarLabelStyle: { fontSize: 11, lineHeight: 14, fontWeight: "600", marginTop: 0 },
        tabBarActiveTintColor: colors.gold,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          height: 74 + bottomPadding,
          paddingTop: 8,
          paddingBottom: bottomPadding,
          overflow: "visible",
          backgroundColor: colors.background,
          borderTopColor: colors.border,
          borderTopWidth: 1,
        },
        tabBarItemStyle: { minHeight: 64, justifyContent: "center", overflow: "visible" },
        tabBarIconStyle: { width: 28, height: 28 },
        tabBarHideOnKeyboard: true,
      }}
    >
      <Tabs.Screen name="(home)" options={{ title: "Home", tabBarIcon: ({ color }) => <ProductionIcon name="tabHome" label="Home" size={26} tintColor={color} /> }} />
      <Tabs.Screen name="(coach)" options={{ title: "Coach", href: "/(tabs)/(coach)", tabBarIcon: ({ color }) => <CoachTabIcon color={color} size={26} /> }} />
      <Tabs.Screen
        name="(record)"
        options={{
          title: "Record",
          tabBarButton: () => <CenterTabButton onPress={() => router.push("/exercise-selection")} />,
        }}
      />
      <Tabs.Screen name="(progress)" options={{ title: "Progress", tabBarIcon: ({ color }) => <ProductionIcon name="tabProgress" label="Progress" size={26} tintColor={color} /> }} />
      <Tabs.Screen name="(profile)" options={{ title: "Settings", tabBarIcon: ({ color }) => <ProductionIcon name="tabProfile" label="Settings" size={26} tintColor={color} /> }} />
    </Tabs>
  );
}
