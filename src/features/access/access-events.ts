export type AccessMutation = { remaining: number | null; periodEndsAt: string | null };

const listeners = new Set<(mutation: AccessMutation) => void>();

export function publishAccessMutation(mutation: AccessMutation): void {
  for (const listener of listeners) listener(mutation);
}

export function subscribeAccessMutations(listener: (mutation: AccessMutation) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
