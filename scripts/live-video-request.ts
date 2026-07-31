export function isRequestTimeout(error: unknown): boolean {
  return typeof error === "object"
    && error !== null
    && "name" in error
    && (error.name === "AbortError" || error.name === "TimeoutError");
}

export function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs = 240_000,
  fetcher: typeof fetch = fetch,
): Promise<Response> {
  return fetcher(url, { ...init, signal: init.signal ?? AbortSignal.timeout(timeoutMs) });
}
