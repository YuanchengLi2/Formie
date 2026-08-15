import type { Metadata } from "next";
import Link from "next/link";

import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = { title: "Privacy Policy", alternates: { canonical: "/privacy" } };

export default function PrivacyPage() {
  return (
    <LegalPage eyebrow="Your privacy" title="Privacy Policy" updated="August 15, 2026">
      <p>This policy explains how Formie handles information when you use the app or website.</p>
      <h2>Information Formie handles</h2>
      <p>Formie handles your name, email, user ID, profile and fitness inputs, exercise declarations, purchase and entitlement status, exercise recordings you upload, support content, analysis results, coaching conversations, product interaction analytics, and diagnostics such as app version, build, platform, and OS version. In-app feedback never automatically includes a recording, analysis content, or device identifier.</p>
      <h2>Video and body-derived analysis</h2>
      <p>Exercise recordings may contain your body, head, hands, equipment, surroundings, and motion. Formie derives exercise and form evidence from those photos or videos to produce the analysis and coaching you request. Recordings are private to your account and are not sold or used for advertising.</p>
      <h2>How information is used</h2>
      <p>We use this information to operate your account, perform requested analysis, provide subscription access, secure the service, respond to support, diagnose failures, and improve Formie&apos;s reliability and product experience.</p>
      <h2>Service providers</h2>
      <p>Supabase provides authentication, database, private storage, and server functions. Google Gemini processes the video and related prompts needed for requested AI analysis. RevenueCat and Apple provide purchase and entitlement state. Vercel hosts the Formie website. Resend delivers feedback or support messages that you choose to submit. These providers process information to perform their services for Formie and may apply their own required operational or legal retention.</p>
      <h2>Linkage and tracking</h2>
      <p>Account, purchase, content, support, diagnostic, and product interaction data may be linked to your Formie user ID. Formie does not use this information for cross-company advertising tracking.</p>
      <h2>Retention and deletion</h2>
      <p>You can delete an individual analysis using its in-app control. You can delete your account in Settings &gt; Delete Account, which removes Formie-controlled account data after the server confirms deletion. See the <Link href="/retention">Retention Policy</Link> and <Link href="/privacy-choices">Privacy Choices</Link> for details.</p>
      <h2>Deletion limits and separate controls</h2>
      <p>Apple, RevenueCat, payment, security, fraud-prevention, backup, support, and legal records may follow separate required schedules. Deleting your Formie account does not cancel your Apple subscription and does not automatically remove your Sign in with Apple authorization. Those Apple controls remain available through Apple settings.</p>
      <h2>Security</h2>
      <p>We use authentication, access controls, and encryption in transit. No system is perfectly secure.</p>
      <h2>Contact</h2>
      <p>Questions about this policy can be sent through <Link href="/support">support</Link> or to <a href="mailto:yuanchengli612@gmail.com">yuanchengli612@gmail.com</a>.</p>
    </LegalPage>
  );
}
