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

export function AppStoreBadge() {
  const url = process.env.NEXT_PUBLIC_APP_STORE_URL;
  if (!url) return <span className="app-store-badge disabled" aria-disabled="true"><Image src="/assets/download-on-app-store.svg" width={120} height={40} alt="Download on the App Store — coming soon" /></span>;
  return <a className="app-store-badge" href={url} aria-label="Download Formie on the App Store"><Image src="/assets/download-on-app-store.svg" width={120} height={40} alt="Download on the App Store" priority /></a>;
}

export function StoreBadgeGroup() {
  const googlePlayUrl = process.env.NEXT_PUBLIC_GOOGLE_PLAY_URL;
  return <div className="store-badge-group"><AppStoreBadge />{googlePlayUrl ? <a className="google-play-badge" href={googlePlayUrl} aria-label="Get Formie on Google Play"><Image src="/assets/get-it-on-google-play.svg" width={124} height={48} alt="Get it on Google Play" /></a> : <span className="google-play-coming" aria-disabled="true"><span className="google-play-badge"><Image src="/assets/get-it-on-google-play.svg" width={124} height={48} alt="Google Play" /></span><small>Coming soon</small></span>}</div>;
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
      <StoreBadgeGroup />
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
        <Link href="/privacy-choices">Privacy Choices</Link>
        <Link href="/retention">Retention</Link>
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
