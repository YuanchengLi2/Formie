import { NextResponse } from "next/server";

const fallback = () => process.env.NEXT_PUBLIC_APP_STORE_URL || "https://useformie.com";
const noStore = { "Cache-Control": "no-store, max-age=0", "Referrer-Policy": "no-referrer", "X-Robots-Tag": "noindex, nofollow, noarchive" };

export async function GET() {
  // Preserve old shared URLs as harmless download redirects. New attribution
  // is created only after a user validates a creator code inside the app.
  return NextResponse.redirect(fallback(), { headers: noStore });
}
