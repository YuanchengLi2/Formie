import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CaptureReferenceIcon } from "@/components/capture-reference-icon";
import { colors } from "@/theme/colors";
import { typography } from "@/theme/type";

type CaptureScreenHeaderProps = {
  title: string;
  onBack: () => void;
  testID?: string;
};

export function CaptureScreenHeader({ title, onBack, testID }: CaptureScreenHeaderProps) {
  const insets = useSafeAreaInsets();

  return (
    <View
      testID={testID}
      style={{
        minHeight: insets.top + 56,
        paddingTop: insets.top,
        paddingHorizontal: 20,
        justifyContent: "center",
        backgroundColor: colors.cameraBlack,
      }}
    >
      <View style={{ height: 56, justifyContent: "center" }}>
        <View pointerEvents="none" style={{ position: "absolute", inset: 0, alignItems: "center", justifyContent: "center" }}>
          <Text selectable style={[typography.heading, { color: colors.gold, fontSize: 18, lineHeight: 24 }]}>
            {title}
          </Text>
        </View>
        <Pressable
          accessibilityLabel={`Go back from ${title}`}
          accessibilityRole="button"
          hitSlop={6}
          onPress={onBack}
          style={({ pressed }) => ({
            width: 42,
            height: 42,
            borderRadius: 21,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.surface,
            opacity: pressed ? 0.78 : 1,
          })}
        >
          <CaptureReferenceIcon name="back" size={25} color={colors.text} />
        </Pressable>
      </View>
    </View>
  );
}
