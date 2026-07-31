import type { Metadata } from "next";

import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = { title: "Privacy Policy", alternates: { canonical: "/privacy" } };

export default function PrivacyPage() {
  return (
    <LegalPage eyebrow="Your privacy" title="Privacy Policy" updated="July 27, 2026">
      <p>This draft explains how Formie handles information when you use the app or website. It will be reviewed and finalized before public release.</p>
      <h2>Information you provide</h2>
      <p>We process your account email, profile settings, exercise declarations, recordings you choose to upload, analysis results, coaching conversations, and feedback you submit. In-app feedback includes only your message, category, account email, app version, build, platform, and OS version. It never automatically includes a recording, analysis content, or device identifier.</p>
      <h2>Private recordings</h2>
      <p>Exercise recordings are private to your account. They are stored in access-controlled storage and are used to provide the analysis you request. Formie does not sell recordings or use them for advertising.</p>
      <h2>AI and service providers</h2>
      <p>Formie sends the content needed to process your request to contracted infrastructure and AI providers, including hosting, database, analytics, and email-delivery services. These providers process information on our behalf to operate Formie. Automated analysis can be incomplete or wrong and is not medical advice.</p>
      <h2>Retention and deletion</h2>
      <p>You can choose to keep recordings until you delete them or use the available automatic retention option for future recordings. Analysis records may remain after a recording is deleted so your coaching history continues to work. Account deletion requests remove or de-identify associated information subject to security, legal, and backup requirements.</p>
      <h2>Security and your choices</h2>
      <p>We use authentication, access controls, and encryption in transit. No system is perfectly secure. You may review retention settings, delete eligible analyses, change account information, or contact support about access or deletion.</p>
      <h2>Contact</h2>
      <p>Questions about this policy can be sent to <a href="mailto:yuanchengli612@gmail.com">yuanchengli612@gmail.com</a>.</p>
    </LegalPage>
  );
}
