import { type ReactNode } from "react";
import {
  KeyboardAvoidingView,
  ScrollView,
  type ScrollViewProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { colors } from "@/theme/colors";
import { usePhoneLayoutProfile } from "@/theme/responsive";

type ResponsiveScreenProps = Omit<ScrollViewProps, "contentContainerStyle"> & {
  children: ReactNode;
  contentContainerStyle?: StyleProp<ViewStyle>;
  keyboardAware?: boolean;
};

export function ResponsiveScreen({
  children,
  contentContainerStyle,
  keyboardAware = false,
  keyboardShouldPersistTaps = keyboardAware ? "handled" : undefined,
  showsVerticalScrollIndicator = false,
  style,
  ...props
}: ResponsiveScreenProps) {
  const layout = usePhoneLayoutProfile();
  const screen = (
    <ScrollView
      {...props}
      alwaysBounceVertical
      bounces
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps={keyboardShouldPersistTaps}
      showsVerticalScrollIndicator={showsVerticalScrollIndicator}
      style={[{ flex: 1, backgroundColor: colors.background }, style]}
      contentContainerStyle={[
        {
          alignSelf: "center",
          width: "100%",
          maxWidth: layout.contentMaxWidth,
          flexGrow: 1,
          paddingHorizontal: layout.horizontalPadding,
          paddingBottom: layout.bottomPadding,
        },
        contentContainerStyle,
      ]}
    >
      {children}
    </ScrollView>
  );

  if (!keyboardAware) return screen;
  return (
    <KeyboardAvoidingView
      behavior={process.env.EXPO_OS === "ios" ? "padding" : undefined}
      style={{ flex: 1, backgroundColor: colors.background }}
    >
      {screen}
    </KeyboardAvoidingView>
  );
}
