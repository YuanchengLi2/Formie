import { Stack } from "expo-router/stack";

import { colors } from "@/theme/colors";

export default function ExerciseStackLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
        headerShadowVisible: false,
        headerBackButtonDisplayMode: "minimal",
        contentStyle: { backgroundColor: colors.background },
      }}
    />
  );
}
