import { createAnatomyInteractionHandlers } from "./anatomy-interaction-surface";

const touchEvent = (touches: { pageX: number; pageY: number }[]) => ({
  nativeEvent: {
    pageX: touches[0]?.pageX ?? 0,
    pageY: touches[0]?.pageY ?? 0,
    touches,
  },
});

describe("AnatomyInteractionSurface", () => {
  it("captures rotation touches before the parent scroll view and refuses takeover", () => {
    const handlers = createAnatomyInteractionHandlers({ onRotate: jest.fn() });
    const event = touchEvent([{ pageX: 20, pageY: 30 }]);
    const gestureState = {};

    expect(handlers.onStartShouldSetPanResponderCapture?.(event as never, gestureState as never)).toBe(true);
    expect(handlers.onMoveShouldSetPanResponderCapture?.(event as never, gestureState as never)).toBe(true);
    expect(handlers.onPanResponderTerminationRequest?.(event as never, gestureState as never)).toBe(false);
  });

  it("turns one-finger movement into incremental 3D rotation", () => {
    const onRotate = jest.fn();
    const handlers = createAnatomyInteractionHandlers({ onRotate });

    handlers.onPanResponderGrant?.(touchEvent([{ pageX: 20, pageY: 30 }]) as never, {} as never);
    handlers.onPanResponderMove?.(touchEvent([{ pageX: 38, pageY: 24 }]) as never, {} as never);

    expect(onRotate).toHaveBeenCalledWith(18, -6);
  });

  it("turns a two-finger distance change into incremental zoom", () => {
    const onZoom = jest.fn();
    const handlers = createAnatomyInteractionHandlers({ onRotate: jest.fn(), onZoom });

    handlers.onPanResponderGrant?.(touchEvent([
      { pageX: 10, pageY: 10 },
      { pageX: 30, pageY: 10 },
    ]) as never, {} as never);
    handlers.onPanResponderMove?.(touchEvent([
      { pageX: 5, pageY: 10 },
      { pageX: 35, pageY: 10 },
    ]) as never, {} as never);

    expect(onZoom).toHaveBeenCalledWith(1.5);
  });
});
