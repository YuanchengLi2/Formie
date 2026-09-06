export type ReferralPreviewRow = {
  visit_id: string;
  creator_display_name: string;
  issued_at: string;
  expires_at: string;
  eligible: boolean;
};

export function referralToken(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const token = value.trim();
  return /^[A-Za-z0-9_-]{43}$/.test(token) ? token : null;
}

export function creatorCode(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const code = value.trim().toUpperCase();
  return /^[A-Z0-9][A-Z0-9-]{2,31}$/.test(code) ? code : null;
}

export function previewFromRows(value: unknown): ReferralPreviewRow | null {
  const row = Array.isArray(value) ? value[0] : value;
  if (!row || typeof row !== "object") return null;
  const candidate = row as Record<string, unknown>;
  if (
    typeof candidate.visit_id !== "string"
    || typeof candidate.creator_display_name !== "string"
    || typeof candidate.issued_at !== "string"
    || typeof candidate.expires_at !== "string"
    || typeof candidate.eligible !== "boolean"
  ) return null;
  return candidate as ReferralPreviewRow;
}
