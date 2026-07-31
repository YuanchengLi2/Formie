import type { Metadata } from "next";

import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = { title: "Terms of Use", alternates: { canonical: "/terms" } };

export default function TermsPage() {
  return (
    <LegalPage eyebrow="Using Formie" title="Terms of Use" updated="July 27, 2026">
      <p>These draft terms describe the rules for using Formie and will be reviewed and finalized before public release.</p>
      <h2>Who may use Formie</h2>
      <p>You must be legally able to agree to these terms and provide accurate account information. Keep your credentials secure and use Formie only for lawful personal exercise coaching.</p>
      <h2>Exercise and AI limitations</h2>
      <p>Formie provides automated educational feedback, not medical diagnosis, treatment, physical therapy, or a substitute for a qualified coach. Analysis may be incomplete, delayed, or wrong. Stop exercising and seek appropriate professional help if you feel pain, dizziness, or other concerning symptoms. You remain responsible for exercise selection, loading, environment, and safety.</p>
      <h2>Your content</h2>
      <p>You retain ownership of recordings and messages you submit. You give Formie permission to host and process that content only as needed to provide, secure, support, and improve the service in accordance with the Privacy Policy and your settings.</p>
      <h2>Subscriptions</h2>
      <p>Formie Pro is not yet available. Before paid subscriptions launch, the app and store listing will show final pricing, included analyses, renewal, cancellation, and refund terms. Purchases made through an app store are also governed by that store’s terms.</p>
      <h2>Acceptable use</h2>
      <p>Do not misuse the service, probe or bypass security, upload content you lack permission to use, interfere with other users, or use automated output to cause harm.</p>
      <h2>Availability and changes</h2>
      <p>We may change or discontinue features, enforce reasonable limits, or suspend access needed to protect users and the service. We do not promise uninterrupted availability.</p>
      <h2>Contact</h2>
      <p>Questions about these terms can be sent to <a href="mailto:yuanchengli612@gmail.com">yuanchengli612@gmail.com</a>.</p>
    </LegalPage>
  );
}
