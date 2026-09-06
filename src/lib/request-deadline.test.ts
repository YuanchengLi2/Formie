import { fetchWithDeadline, withRequestDeadline } from "./request-deadline";

describe("request deadlines", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks(); });

  it("settles even when the transport ignores abort", async () => {
    let signal!: AbortSignal;
    const request = withRequestDeadline((incoming) => { signal = incoming; return new Promise(() => undefined); }, 100);
    const assertion = expect(request).rejects.toThrow("timed out");
    await jest.advanceTimersByTimeAsync(100);
    await assertion;
    expect(signal.aborted).toBe(true);
    expect(jest.getTimerCount()).toBe(0);
  });

  it("propagates caller cancellation and releases its timer", async () => {
    const controller = new AbortController();
    const request = withRequestDeadline(() => new Promise(() => undefined), 100, controller.signal);
    const assertion = expect(request).rejects.toMatchObject({ name: "AbortError" });
    controller.abort();
    await assertion;
    expect(jest.getTimerCount()).toBe(0);
  });

  it("does not start an already cancelled request", async () => {
    const controller = new AbortController();
    controller.abort();
    const operation = jest.fn();
    await expect(withRequestDeadline(operation, 100, controller.signal)).rejects.toMatchObject({ name: "AbortError" });
    expect(operation).not.toHaveBeenCalled();
  });

  it("times out a stalled JSON body after headers arrive", async () => {
    jest.spyOn(globalThis, "fetch").mockResolvedValue({ headers: new Headers({ "content-type": "application/json" }), text: () => new Promise(() => undefined) } as Response);
    const assertion = expect(fetchWithDeadline("https://example.test")).rejects.toThrow("timed out");
    await jest.advanceTimersByTimeAsync(30_000);
    await assertion;
  });

  it("preserves JSON status, headers, and payload", async () => {
    jest.spyOn(globalThis, "fetch").mockResolvedValue(new Response('{"code":"retry"}', { status: 503, headers: { "content-type": "application/json", "retry-after": "2" } }));
    const response = await fetchWithDeadline("https://example.test");
    expect(response.status).toBe(503);
    expect(response.headers.get("retry-after")).toBe("2");
    await expect(response.json()).resolves.toEqual({ code: "retry" });
    expect(jest.getTimerCount()).toBe(0);
  });
});
