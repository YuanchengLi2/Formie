import { NextResponse, type NextRequest } from "next/server";

import { buildContentSecurityPolicy } from "./lib/security-headers";

export function proxy(request: NextRequest) {
  const nonce = btoa(crypto.randomUUID());
  const contentSecurityPolicy = buildContentSecurityPolicy(nonce, process.env.NODE_ENV === "production", process.env.NEXT_PUBLIC_SUPABASE_URL);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", contentSecurityPolicy);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", contentSecurityPolicy);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export const config = {
  matcher: [{ source: "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)" }],
};
