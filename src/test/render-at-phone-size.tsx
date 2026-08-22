import { type ReactElement } from "react";
import { Dimensions } from "react-native";
import { act, render } from "@testing-library/react-native";
import { type EdgeInsets, SafeAreaProvider } from "react-native-safe-area-context";

type PhoneRenderOptions = {
  width: number;
  height: number;
  fontScale: number;
  insets: EdgeInsets;
};

export async function renderAtPhoneSize(element: ReactElement, options: PhoneRenderOptions) {
  const previousWindow = Dimensions.get("window");
  const previousScreen = Dimensions.get("screen");
  const nextDimensions = {
    width: options.width,
    height: options.height,
    fontScale: options.fontScale,
    scale: 1,
  };
  Dimensions.set({ window: nextDimensions, screen: nextDimensions });
  const result = await render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: options.width, height: options.height },
        insets: options.insets,
      }}
    >
      {element}
    </SafeAreaProvider>,
  );

  return Object.assign(result, {
    restoreWindowDimensions: () => act(() => Dimensions.set({ window: previousWindow, screen: previousScreen })),
  });
}
