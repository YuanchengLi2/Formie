export function friendlyPurchaseError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/cancel|user.?abort/i.test(message)) return "";
  if (/unavailable|not configured|available in the iOS/i.test(message)) return "The Formie subscription is not available on this device yet.";
  return "Formie could not complete that purchase. Try again.";
}
