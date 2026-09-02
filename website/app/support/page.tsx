import type { Metadata } from "next";

import { SiteShell } from "../../components/site-shell";
import { SupportForm } from "./support-form";

export const metadata: Metadata = {
  title: "Support | Formie",
  description: "Contact Formie support.",
};

export default function SupportPage() {
  return (
    <SiteShell>
      <section className="support-page">
        <div className="support-page-intro">
          <p className="eyebrow">Support</p>
          <h1>Contact Formie support.</h1>
          <p>Tell us what happened and include the details we need to help. We’ll reply to the email you provide.</p>
          <p>Email us directly at <a href="mailto:support@useformie.com">support@useformie.com</a>.</p>
        </div>
        <SupportForm />
      </section>
    </SiteShell>
  );
}
