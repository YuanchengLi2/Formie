import { Stack } from "expo-router/stack";

import { colors } from "@/theme/colors";

export default function ProgressStackLayout() {
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }} />;
}
