import type { Metadata } from "next";

import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = { title: "Terms of Use", alternates: { canonical: "/terms" } };

export default function TermsPage() {
  return (
    <LegalPage eyebrow="Using Formie" title="Terms of Use" updated="September 1, 2026">
      <p>These terms govern your use of the Formie app and website.</p>
      <h2>Who may use Formie</h2>
      <p>You must be at least 18 years old, legally able to agree to these terms, and provide accurate account information. Keep your credentials secure and use Formie only for lawful personal exercise education.</p>
      <h2>Exercise and AI limitations</h2>
      <p>Formie provides automated educational feedback, not medical diagnosis, treatment, physical therapy, or a substitute for a qualified coach. Analysis may be incomplete, delayed, or wrong. Stop exercising and seek appropriate professional help if you feel pain, dizziness, or other concerning symptoms. You remain responsible for exercise selection, loading, environment, and safety.</p>
      <h2>Your content</h2>
      <p>You retain ownership of recordings and messages you submit. You give Formie permission to host and process that content only as needed to provide, secure, support, and improve the service in accordance with the Privacy Policy and your settings.</p>
      <h2>YouTube tutorials</h2>
      <p>For catalog exercises, Formie may offer an external link to a public YouTube tutorial selected through the YouTube Data API. Formie does not download or host these videos. Your use of YouTube is subject to the <a href="https://www.youtube.com/t/terms">YouTube Terms of Service</a>.</p>
      <h2>Subscriptions</h2>
      <p>Formie Pro is a monthly auto-renewable subscription offered at the localized price shown before purchase. Payment is charged to your Apple ID when the purchase is confirmed. The subscription automatically renews each month until cancelled, unless you cancel at least 24 hours before the current period ends. Apple may charge renewal within 24 hours before the end of that period.</p>
      <p>Manage your subscription in the Formie app, which opens Apple subscription settings where you can change or cancel it. Deleting your Formie account does not cancel your Apple subscription. Restore Purchases is available in the app for eligible purchases.</p>
      <p>Formie Pro includes 10 analyses in each monthly quota period, and unused analyses do not roll over. Existing provider-managed annual access, if present, remains honored through its verified paid-through date, but an annual plan is not offered as a new in-app purchase.</p>
      <h2>Account deletion</h2>
      <p>You can permanently delete your account in Formie Settings. Successful deletion removes Formie-controlled user content, subject to limited processor, security, backup, billing, fraud-prevention, and legal retention described in the <a href="/privacy">Privacy Policy</a> and <a href="/retention">Retention Policy</a>. Account deletion does not cancel Apple billing.</p>
      <h2>Acceptable use</h2>
      <p>Do not misuse the service, probe or bypass security, upload content you lack permission to use, interfere with other users, or use automated output to cause harm.</p>
      <h2>Availability and changes</h2>
      <p>We may change or discontinue features, enforce reasonable limits, or suspend access needed to protect users and the service. We do not promise uninterrupted availability.</p>
      <h2>Apple terms</h2>
      <p>Apple&apos;s <a href="https://www.apple.com/legal/internet-services/itunes/dev/stdeula/">Standard End User License Agreement</a> also applies to the iOS app.</p>
      <h2>Contact</h2>
      <p>Questions about these terms can be sent to <a href="mailto:support@useformie.com">support@useformie.com</a>.</p>
    </LegalPage>
  );
}
