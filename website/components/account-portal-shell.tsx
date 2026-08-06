import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

export function AccountPortalShell({ children, onSignOut, signingOut = false }: { children: ReactNode; onSignOut: () => void; signingOut?: boolean }) {
  return <section className="portal-shell">
    <aside className="portal-rail" aria-label="Account navigation">
      <div className="portal-rail-brand"><Image src="/assets/formie-mark.png" width={36} height={36} alt="" /><span>FORMIE</span></div>
      <nav>
        <Link href="/">⌂ <span>Home</span></Link>
        <Link href="/manage-subscription" aria-current="page">♛ <span>Subscription</span></Link>
        <Link href="/support">? <span>Support</span></Link>
        <a href="form://">↗ <span>Open App</span></a>
      </nav>
      <button type="button" onClick={onSignOut} disabled={signingOut}>⇥ <span>{signingOut ? "Signing out…" : "Sign Out"}</span></button>
    </aside>
    <div className="portal-mobile-nav">
      <Link href="/">Home</Link><Link href="/manage-subscription" aria-current="page">Subscription</Link><Link href="/support">Support</Link><a href="form://">Open App</a><button type="button" onClick={onSignOut}>Sign Out</button>
    </div>
    <div className="portal-shell-content">{children}</div>
  </section>;
}
