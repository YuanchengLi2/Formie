// Bound both response headers and body reads using Node's fetch cancellation.
// Preserve cancellation already supplied by the caller.
export const reportingFetch: typeof fetch = (input, init) => {
  const callerSignal = init?.signal ?? (input instanceof Request ? input.signal : undefined);
  const deadline = AbortSignal.timeout(30_000);
  return fetch(input, {
    ...init,
    signal: callerSignal ? AbortSignal.any([callerSignal, deadline]) : deadline,
  });
};
