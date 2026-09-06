export function isAdminEmail(email: string | null | undefined, configuredEmail: string | undefined): boolean {
  if (!email || !configuredEmail?.trim()) return false;
  const normalized = email.trim().toLowerCase();
  return configuredEmail.split(",").some((candidate) => candidate.trim().toLowerCase() === normalized);
}
