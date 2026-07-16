import { bindAuthRefreshLifecycle } from "./auth-refresh-lifecycle";

describe("auth refresh lifecycle", () => {
  it("runs native refresh only while the app is active", () => {
    const start = jest.fn();
    const stop = jest.fn();
    const remove = jest.fn();
    let listener: (state: string) => void = () => undefined;

    const cleanup = bindAuthRefreshLifecycle({
      platform: "ios",
      currentState: "active",
      start,
      stop,
      addListener: (next) => {
        listener = next;
        return { remove };
      },
    });

    expect(start).toHaveBeenCalledTimes(1);
    listener("active");
    expect(start).toHaveBeenCalledTimes(1);
    listener("background");
    expect(stop).toHaveBeenCalledTimes(1);
    listener("active");
    expect(start).toHaveBeenCalledTimes(2);
    cleanup();
    expect(remove).toHaveBeenCalledTimes(1);
    expect(stop).toHaveBeenCalledTimes(2);
  });

  it("leaves web refresh management to browser visibility", () => {
    const start = jest.fn();
    const stop = jest.fn();
    const addListener = jest.fn();

    const cleanup = bindAuthRefreshLifecycle({
      platform: "web",
      currentState: "active",
      start,
      stop,
      addListener,
    });

    cleanup();
    expect(addListener).not.toHaveBeenCalled();
    expect(start).not.toHaveBeenCalled();
    expect(stop).not.toHaveBeenCalled();
  });
});
