import type { Metadata } from "next";
import Link from "next/link";

import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = { title: "Privacy Policy", alternates: { canonical: "/privacy" } };

export default function PrivacyPage() {
  return (
    <LegalPage eyebrow="Your privacy" title="Privacy Policy" updated="September 1, 2026">
      <p>This policy explains how Formie handles information when you use the app or website.</p>
      <h2>Information Formie handles</h2>
      <p>Formie handles your name, email, user ID, profile and fitness inputs, exercise declarations, purchase and entitlement status, exercise recordings you upload, support content, analysis results, any legacy coaching conversations created during earlier testing, product interaction analytics, and diagnostics such as app version, build, platform, and OS version. The Formie 1.0 Coach Preview does not let users create new conversations. In-app feedback never automatically includes a recording, analysis content, or device identifier.</p>
      <h2>Video and body-derived analysis</h2>
      <p>Exercise recordings may contain your body, head, hands, equipment, surroundings, and motion. Formie derives exercise and form evidence from those photos or videos to produce the analysis and coaching you request. Recordings are private to your account and are not sold or used for advertising.</p>
      <h2>Your choice before AI processing</h2>
      <p>Before Formie uploads or sends personal information for AI analysis, account creation presents a separate affirmative AI-processing choice in addition to the Terms and Privacy acceptance. The notice identifies the data sent: your exercise video, exercise declaration, and relevant profile information. It also identifies the recipient: Formie&apos;s servers and the paid Google Gemini API. Existing accounts that have not made this choice are asked before entering the recording flow. Choosing Not Now sends nothing and leaves the rest of the app available.</p>
      <p>You can withdraw consent for future analyses from the AI Processing section in Formie. Withdrawal immediately blocks new analyses, reanalyses, and provider retries that have not started. It does not erase results you already requested; use the individual-analysis or account-deletion controls for deletion.</p>
      <h2>How information is used</h2>
      <p>We use this information to operate your account, perform requested analysis, provide subscription access, secure the service, respond to support, diagnose failures, and improve Formie&apos;s reliability and product experience.</p>
      <h2>Service providers</h2>
      <p>Supabase provides authentication, database, private storage, and server functions. The paid Google Gemini API processes the exercise video, exercise declaration, relevant profile context, and related instructions needed for the AI analysis you request. Google may retain limited data for abuse and safety monitoring under its paid-service terms. RevenueCat and Apple provide purchase, entitlement, and authentication state. Vercel hosts the Formie website. Resend delivers feedback or support messages that you choose to submit.</p>
      <p>YouTube Data API provides public exercise-tutorial metadata for catalog exercises. Formie sends only a canonical exercise name to YouTube; it does not send your recording, Formie user ID, profile, declaration, free-form note, or analysis content. Tutorial videos remain on YouTube and open through YouTube or the system browser.</p>
      <p>Formie uses these providers only to perform the described services and requires contractual and technical protections designed to provide the same or equal protection described in this policy. Providers may retain limited operational, safety, security, billing, fraud-prevention, or legal records under their applicable terms.</p>
      <h2>Linkage and tracking</h2>
      <p>Account, purchase, content, support, diagnostic, and product interaction data may be linked to your Formie user ID. Formie does not use this information for cross-company advertising tracking.</p>
      <h2>Retention and deletion</h2>
      <p>You can delete an individual analysis using its in-app control. You can delete your account in Settings &gt; Delete Account, which removes Formie-controlled account data after the server confirms deletion. See the <Link href="/retention">Retention Policy</Link> and <Link href="/privacy-choices">Privacy Choices</Link> for details.</p>
      <h2>Deletion limits and separate controls</h2>
      <p>Deleting your Formie account does not cancel your Apple subscription. Formie also requests deletion or revocation from Sign in with Apple, Google Gemini, RevenueCat, Supabase, and Formie storage. Provider failures are preserved in an encrypted cleanup queue so they do not block deletion of the Formie account. If a legacy Sign in with Apple account has no stored revocation credential, Formie still deletes the account and directs the user to Apple&apos;s settings to revoke Formie access manually. Limited payment, security, fraud-prevention, backup, support, and legal records may follow separate required schedules.</p>
      <h2>Security</h2>
      <p>We use authentication, access controls, and encryption in transit. No system is perfectly secure.</p>
      <h2>Contact</h2>
      <p>Questions about this policy can be sent through <Link href="/support">support</Link> or to <a href="mailto:support@useformie.com">support@useformie.com</a>.</p>
    </LegalPage>
  );
}
