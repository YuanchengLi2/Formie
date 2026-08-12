export async function runNonBlockingWriter<T>(input: {
  write: () => Promise<unknown>;
  merge: (value: unknown) => T;
  fallback: () => T;
  onError?: (error: unknown) => void;
}): Promise<T> {
  try {
    return input.merge(await input.write());
  } catch (error) {
    input.onError?.(error);
    return input.fallback();
  }
}
