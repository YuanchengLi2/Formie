export async function fulfilledFrameValues<T>(tasks: Promise<T>[]): Promise<T[]> {
  const settled = await Promise.allSettled(tasks);
  return settled.flatMap((result) => result.status === "fulfilled" ? [result.value] : []);
}
