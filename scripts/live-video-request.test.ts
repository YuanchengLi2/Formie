import { fetchWithTimeout, isRequestTimeout } from "./live-video-request";

describe("live benchmark HTTP timeout", () => {
  it("aborts a request that never returns", async () => {
    const neverReturns = jest.fn((_url: string, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(init.signal?.reason));
    }));

    const request = fetchWithTimeout("https://example.test", {}, 5, neverReturns as typeof fetch);

    try {
      await request;
      throw new Error("request unexpectedly completed");
    } catch (error) {
      expect(isRequestTimeout(error)).toBe(true);
    }
  });
});
