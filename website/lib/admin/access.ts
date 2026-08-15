export function isAdminEmail(email: string | null | undefined, configuredEmail: string | undefined): boolean {
  if (!email || !configuredEmail?.trim()) return false;
  return email.trim().toLowerCase() === configuredEmail.trim().toLowerCase();
}
