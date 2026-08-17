import { useMemo, useRef, useState } from "react";
import { PanResponder, View } from "react-native";
import { HapticPressable as Pressable } from "@/components/haptic-pressable";

import {
  anatomyRotationFromSlider,
  normalizedAnatomyRotation,
} from "@/components/anatomy-rotation";
import { colors } from "@/theme/colors";

export function AnatomyRotationControl({
  rotation,
  onChange,
}: {
  rotation: number;
  onChange: (rotation: number) => void;
}) {
  const [width, setWidth] = useState(1);
  const widthRef = useRef(1);
  const responder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (event) => {
      onChange(anatomyRotationFromSlider(event.nativeEvent.locationX, widthRef.current));
    },
    onPanResponderMove: (event) => {
      onChange(anatomyRotationFromSlider(event.nativeEvent.locationX, widthRef.current));
    },
  }), [onChange]);
  const progress = normalizedAnatomyRotation(rotation);

  return (
    <View style={{ gap: 6 }}>
      <Pressable
        {...responder.panHandlers}
        accessibilityActions={[
          { name: "decrement", label: "Rotate left" },
          { name: "increment", label: "Rotate right" },
        ]}
        accessibilityLabel="Rotate anatomy"
        accessibilityRole="adjustable"
        accessibilityValue={{ min: 0, max: 360, now: Math.round(progress * 360), text: `${Math.round(progress * 360)} degrees` }}
        onAccessibilityAction={(event) => {
          const direction = event.nativeEvent.actionName === "decrement" ? -1 : 1;
          onChange(rotation + direction * Math.PI / 12);
        }}
        onLayout={(event) => {
          const nextWidth = Math.max(1, event.nativeEvent.layout.width);
          widthRef.current = nextWidth;
          setWidth(nextWidth);
        }}
        onPress={(event) => onChange(anatomyRotationFromSlider(event.nativeEvent.locationX, width))}
        style={{ minHeight: 44, justifyContent: "center", paddingHorizontal: 2 }}
      >
        <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.border }}>
          <View style={{ width: `${progress * 100}%`, height: 6, borderRadius: 3, backgroundColor: colors.gold }} />
          <View style={{ position: "absolute", left: `${progress * 100}%`, top: -7, width: 20, height: 20, marginLeft: -10, borderRadius: 10, borderWidth: 3, borderColor: colors.background, backgroundColor: colors.gold }} />
        </View>
      </Pressable>
    </View>
  );
}
