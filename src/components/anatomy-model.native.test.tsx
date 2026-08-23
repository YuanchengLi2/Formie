/* eslint-disable @typescript-eslint/no-require-imports, import/first -- Native modules are mocked before loading the platform component. */
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";

const controller = {
  setSelection: jest.fn(),
  setRotation: jest.fn(),
  render: jest.fn(),
  dispose: jest.fn(),
};
const mockCreateAnatomyRenderer = jest.fn(async (_input?: unknown) => controller);

jest.mock("react-native-webgpu", () => {
  const React = require("react");
  const { View } = require("react-native");
  const Canvas = React.forwardRef((props: Record<string, unknown>, ref: React.Ref<unknown>) => {
    React.useImperativeHandle(ref, () => ({ getContext: () => ({ canvas: { width: 390, height: 430 }, present: jest.fn() }) }));
    return React.createElement(View, props);
  });
  Canvas.displayName = "WebGPUCanvas";
  return { Canvas };
}, { virtual: true });

jest.mock("./anatomy-webgpu-runtime.native", () => ({
  createAnatomyRenderer: (input: unknown) => mockCreateAnatomyRenderer(input),
}), { virtual: true });

import { AnatomyModel } from "./anatomy-model.native";

describe("native AnatomyModel", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCreateAnatomyRenderer.mockResolvedValue(controller);
  });

  it("mounts a native WebGPU canvas and paints updated tagged muscle selections", async () => {
    const screen = await render(<AnatomyModel targetRegions={["chest"]} secondaryRegions={["triceps"]} issueRegions={["shoulders"]} />);
    expect(screen.getByTestId("anatomy-3d-canvas")).toBeTruthy();
    expect(screen.queryByTestId("native-muscle-map")).toBeNull();
    await waitFor(() => expect(mockCreateAnatomyRenderer).toHaveBeenCalledTimes(1));

    screen.rerender(<AnatomyModel targetRegions={["lats"]} secondaryRegions={["biceps"]} issueRegions={["elbows"]} />);
    await waitFor(() => expect(controller.setSelection).toHaveBeenCalledWith({
      targetRegions: ["lats"], secondaryRegions: ["biceps"], issueRegions: ["elbows"],
    }));
  });

  it("supports accessibility rotation and disposes the GPU renderer on unmount", async () => {
    const screen = await render(<AnatomyModel targetRegions={["chest"]} secondaryRegions={[]} issueRegions={[]} />);
    await waitFor(() => expect(mockCreateAnatomyRenderer).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByText("Loading 3D muscle model…")).toBeNull());
    await act(async () => fireEvent(screen.getByTestId("anatomy-gesture-surface"), "accessibilityAction", { nativeEvent: { actionName: "increment" } }));
    expect(controller.setRotation).toHaveBeenCalledWith(expect.any(Number));
    await act(async () => screen.unmount());
    await waitFor(() => expect(controller.dispose).toHaveBeenCalledTimes(1));
  });

  it("offers a real renderer retry without falling back to the 2D map", async () => {
    mockCreateAnatomyRenderer.mockRejectedValueOnce(new Error("GPU initialization failed")).mockResolvedValueOnce(controller);
    const screen = await render(<AnatomyModel targetRegions={["chest"]} secondaryRegions={[]} issueRegions={[]} />);
    await waitFor(() => expect(screen.getByText("The 3D muscle model could not load.")).toBeTruthy());
    expect(screen.queryByTestId("native-muscle-map")).toBeNull();
    await fireEvent.press(screen.getByText("Retry 3D Model"));
    await waitFor(() => expect(mockCreateAnatomyRenderer).toHaveBeenCalledTimes(2));
  });
});
