export async function writeValidatedCoaching<T>(input: {
  write: () => Promise<unknown>;
  repair: (input: { rejected: unknown; validationError: unknown }) => Promise<unknown>;
  parse: (value: unknown) => T;
}): Promise<T> {
  const first = await input.write();
  try {
    return input.parse(first);
  } catch (validationError) {
    const repaired = await input.repair({ rejected: first, validationError });
    return input.parse(repaired);
  }
}
