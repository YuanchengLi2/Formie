export async function writeValidatedCoaching<T>(input: {
  write: () => Promise<unknown>;
  repair: (input: { rejected: unknown; validationError: unknown }) => Promise<unknown>;
  parse: (value: unknown) => T;
  normalize: (value: unknown) => T;
}): Promise<T> {
  let response: unknown;
  try {
    response = await input.write();
  } catch {
    return input.normalize(null);
  }
  try {
    return input.parse(response);
  } catch (validationError) {
    let repaired: unknown;
    try {
      repaired = await input.repair({ rejected: response, validationError });
    } catch {
      return input.normalize(response);
    }
    try {
      return input.parse(repaired);
    } catch {
      return input.normalize(repaired);
    }
  }
}
