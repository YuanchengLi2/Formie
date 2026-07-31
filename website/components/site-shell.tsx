import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

const nav = [
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#coaching", label: "Coaching" },
  { href: "/#pricing", label: "Pricing" },
];

export function DownloadButton({ compact = false }: { compact?: boolean }) {
  const url = process.env.NEXT_PUBLIC_APP_STORE_URL;
  if (!url) {
    return (
      <span className={`button disabled ${compact ? "compact" : ""}`} aria-disabled="true">
        {compact ? "App Store — Soon" : "Coming to the App Store"}
      </span>
    );
  }
  return <a className={`button ${compact ? "compact" : ""}`} href={url} rel="noreferrer">Download Formie</a>;
}

export function SiteHeader() {
  return (
    <header className="site-header">
      <Link className="brand" href="/" aria-label="Formie home">
        <Image src="/assets/formie-mark.png" width={40} height={40} alt="" priority />
        <span>Formie</span>
      </Link>
      <nav aria-label="Main navigation">
        {nav.map((item) => <Link href={item.href} key={item.href}>{item.label}</Link>)}
      </nav>
      <DownloadButton compact />
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <Link className="brand light" href="/">
        <Image src="/assets/formie-mark.png" width={34} height={34} alt="" />
        <span>Formie</span>
      </Link>
      <div className="footer-links">
        <Link href="/privacy">Privacy</Link>
        <Link href="/terms">Terms</Link>
        <Link href="/support">Support</Link>
      </div>
      <span>© {new Date().getFullYear()} Formie</span>
    </footer>
  );
}

export function SiteShell({ children }: { children: ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main>{children}</main>
      <SiteFooter />
    </>
  );
}

export function GoldCta({ title, body }: { title: string; body?: string }) {
  return (
    <section className="gold-cta">
      <div>
        <h2>{title}</h2>
        {body ? <p>{body}</p> : null}
      </div>
      <DownloadButton />
    </section>
  );
}
