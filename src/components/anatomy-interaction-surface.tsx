import { useMemo } from "react";
import {
  PanResponder,
  type GestureResponderEvent,
  type PanResponderCallbacks,
  type ViewProps,
  View,
} from "react-native";

type TouchPoint = {
  pageX: number;
  pageY: number;
};

type AnatomyInteractionSurfaceProps = ViewProps & {
  onRotate: (deltaX: number, deltaY: number) => void;
  onZoom?: (scale: number) => void;
};

type AnatomyInteractionCallbacks = Pick<
  AnatomyInteractionSurfaceProps,
  "onRotate" | "onZoom"
>;

function touchPoints(event: GestureResponderEvent): readonly TouchPoint[] {
  return event.nativeEvent.touches;
}

function distance(first: TouchPoint, second: TouchPoint): number {
  return Math.hypot(second.pageX - first.pageX, second.pageY - first.pageY);
}

export function createAnatomyInteractionHandlers({
  onRotate,
  onZoom,
}: AnatomyInteractionCallbacks): PanResponderCallbacks {
  let lastGesture = { x: 0, y: 0, distance: 0 };
  return {
    onStartShouldSetPanResponder: () => true,
    onStartShouldSetPanResponderCapture: () => true,
    onMoveShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponderCapture: () => true,
    onPanResponderTerminationRequest: () => false,
    onShouldBlockNativeResponder: () => true,
    onPanResponderGrant: (event) => {
      const touches = touchPoints(event);
      const first = touches[0];
      const second = touches[1];
      lastGesture = {
        x: first?.pageX ?? event.nativeEvent.pageX,
        y: first?.pageY ?? event.nativeEvent.pageY,
        distance: first && second ? distance(first, second) : 0,
      };
    },
    onPanResponderMove: (event) => {
      const touches = touchPoints(event);
      const first = touches[0];
      const second = touches[1];
      if (first && second) {
        const nextDistance = distance(first, second);
        if (lastGesture.distance > 0 && nextDistance > 0) {
          onZoom?.(nextDistance / lastGesture.distance);
        }
        lastGesture = {
          x: first.pageX,
          y: first.pageY,
          distance: nextDistance,
        };
        return;
      }

      const x = first?.pageX ?? event.nativeEvent.pageX;
      const y = first?.pageY ?? event.nativeEvent.pageY;
      onRotate(x - lastGesture.x, y - lastGesture.y);
      lastGesture = { x, y, distance: 0 };
    },
  };
}

export function AnatomyInteractionSurface({
  children,
  onRotate,
  onZoom,
  ...viewProps
}: AnatomyInteractionSurfaceProps) {
  const responder = useMemo(
    () => PanResponder.create(createAnatomyInteractionHandlers({ onRotate, onZoom })),
    [onRotate, onZoom],
  );

  return (
    <View {...viewProps} {...responder.panHandlers} collapsable={false}>
      {children}
    </View>
  );
}
