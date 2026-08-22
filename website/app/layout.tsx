import type { Metadata } from "next";
import { Archivo_Black, Manrope } from "next/font/google";
import { connection } from "next/server";

import "./globals.css";
import "./landing-v2.css";

const body = Manrope({ subsets: ["latin"], variable: "--font-body" });
const display = Archivo_Black({ subsets: ["latin"], weight: "400", variable: "--font-display" });

export const metadata: Metadata = {
  metadataBase: new URL("https://useformie.com"),
  title: {
    default: "Formie — See your form differently",
    template: "%s — Formie",
  },
  description: "Review short exercise videos with clear, evidence-linked coaching for your next rep.",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: "https://useformie.com",
    siteName: "Formie",
    title: "Formie — See your form differently",
    description: "See the moment, understand the correction, and improve your next rep.",
  },
  robots: { index: true, follow: true },
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // A request-specific CSP nonce can only be attached to Next's scripts during
  // dynamic rendering. Keep this at the root so no public or admin route can
  // accidentally ship static script tags without the proxy-generated nonce.
  await connection();
  return (
    <html lang="en" className={`${body.variable} ${display.variable}`}>
      <body>{children}</body>
    </html>
  );
}
