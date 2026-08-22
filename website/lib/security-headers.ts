export const productionSecurityHeaders: readonly [string, string][] = [
  ["Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload"],
  ["X-Content-Type-Options", "nosniff"],
  ["X-Frame-Options", "DENY"],
  ["Referrer-Policy", "strict-origin-when-cross-origin"],
  ["Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=()"],
  ["Cross-Origin-Opener-Policy", "same-origin"],
  ["Cross-Origin-Resource-Policy", "same-origin"],
];

export function buildContentSecurityPolicy(nonce: string, production: boolean, supabaseOrigin?: string): string {
  const scriptSources = ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'", ...(production ? [] : ["'unsafe-eval'"])];
  const connectSources = ["'self'"];
  if (supabaseOrigin) {
    const parsed = new URL(supabaseOrigin);
    connectSources.push(parsed.origin, parsed.origin.replace(/^https:/, "wss:"));
  }
  return [
    "default-src 'self'",
    `script-src ${scriptSources.join(" ")}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    `connect-src ${connectSources.join(" ")}`,
    "media-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(production ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
}
