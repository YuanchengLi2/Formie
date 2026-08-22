const WINDOW_MS = 15 * 60 * 1_000;
const MAX_ATTEMPTS = 8;
const attempts = new Map<string, number[]>();

export function consumeAdminLoginAttempt(key: string, now = Date.now()): boolean {
  const cutoff = now - WINDOW_MS;
  const recent = (attempts.get(key) ?? []).filter((timestamp) => timestamp > cutoff);
  if (recent.length >= MAX_ATTEMPTS) {
    attempts.set(key, recent);
    return false;
  }
  recent.push(now);
  attempts.set(key, recent);
  return true;
}

export function resetAdminLoginRateLimitForTests(): void {
  attempts.clear();
}
