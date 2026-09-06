export async function withRequestDeadline<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  timeoutMs = 30_000,
  parentSignal?: AbortSignal | null,
): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let onAbort: () => void = () => undefined;
  const deadline = new Promise<never>((_, reject) => {
    onAbort = () => {
      controller.abort();
      reject(Object.assign(new Error("Request cancelled"), { name: "AbortError" }));
    };
    if (parentSignal?.aborted) { onAbort(); return; }
    parentSignal?.addEventListener("abort", onAbort, { once: true });
    timer = setTimeout(() => {
      controller.abort();
      reject(Object.assign(new Error("Network request timed out. Try again."), { name: "TimeoutError" }));
    }, timeoutMs);
  });
  try {
    if (parentSignal?.aborted) return await deadline;
    return await Promise.race([deadline, operation(controller.signal)]);
  } finally {
    if (timer) clearTimeout(timer);
    parentSignal?.removeEventListener("abort", onAbort);
  }
}

// Supabase control requests return JSON. Include body consumption in the same
// deadline: receiving response headers alone does not mean a request completed.
export const fetchWithDeadline: typeof fetch = (input, init) => withRequestDeadline(async (signal) => {
  const response = await fetch(input, { ...init, signal });
  if (!response.headers.get("content-type")?.includes("json")) return response;
  const body = await response.text();
  return new Response(body, { status: response.status, statusText: response.statusText, headers: response.headers });
}, 30_000, init?.signal ?? (typeof Request !== "undefined" && input instanceof Request ? input.signal : undefined));
