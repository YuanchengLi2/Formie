export async function reconcileUntil<T>(operation: () => Promise<T>, expected: (value: T) => boolean, delays = [0, 500, 1_500, 3_500, 7_000], wait = (milliseconds: number) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds))): Promise<T> {
  let result = await operation();
  if (expected(result)) return result;
  for (const delay of delays.slice(1)) {
    await wait(delay);
    result = await operation();
    if (expected(result)) return result;
  }
  return result;
}

export type ReconciliationResult<T> = { value: T; satisfied: boolean; attempts: number };

export async function reconcileWithDeadline<T>(operation: () => Promise<T>, expected: (value: T) => boolean, delays = [0, 1_000, 3_000, 7_000, 15_000, 30_000], wait = (milliseconds: number) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds))): Promise<ReconciliationResult<T>> {
  let attempts = 0;
  let value = await operation();
  attempts += 1;
  if (expected(value)) return { value, satisfied: true, attempts };
  for (const delay of delays.slice(1)) {
    await wait(delay);
    value = await operation();
    attempts += 1;
    if (expected(value)) return { value, satisfied: true, attempts };
  }
  return { value, satisfied: false, attempts };
}
