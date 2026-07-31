import type { ReactNode } from "react";

import { SiteShell } from "./site-shell";

export function LegalPage({ eyebrow, title, updated, children }: { eyebrow: string; title: string; updated: string; children: ReactNode }) {
  return (
    <SiteShell>
      <article className="legal">
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p className="updated">Last updated {updated}</p>
        {children}
      </article>
    </SiteShell>
  );
}
