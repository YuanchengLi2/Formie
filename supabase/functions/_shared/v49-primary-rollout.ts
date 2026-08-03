/**
 * Primary v49 routing is deliberately fail-closed during the shadow QA window.
 * Use one exact value so a misspelled or inherited environment value cannot
 * activate a new producer for an older released client.
 */
export function isV49PrimaryRolloutEnabled(value: string | undefined): boolean {
  return value === "true";
}
