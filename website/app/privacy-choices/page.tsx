import type { Metadata } from "next";
import Link from "next/link";

import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Privacy Choices",
  alternates: { canonical: "/privacy-choices" },
};

export default function PrivacyChoicesPage() {
  return (
    <LegalPage eyebrow="Your controls" title="Privacy Choices" updated="August 15, 2026">
      <p>These controls let you manage Formie data and the separate Apple services connected to the app. For timing and exceptions, see the <Link href="/retention">Retention Policy</Link> and <Link href="/privacy">Privacy Policy</Link>.</p>
      <h2>Delete your Formie account</h2>
      <p>In the app, open Settings &gt; Delete Account, review what will be removed, type DELETE, and choose Delete Account Now. You can delete immediately even with an active subscription. Formie does not require you to cancel Apple billing first.</p>
      <h2>Delete an analysis</h2>
      <p>Open an analysis in Formie and use its delete action to remove that analysis and its eligible server-side recording and processing artifacts without deleting your account.</p>
      <h2>Manage Apple billing</h2>
      <p>Deleting Formie data does not cancel an Apple subscription. Use Manage Apple Subscription in the deletion dialog or Settings &gt; Subscription in Formie to open Apple&apos;s subscription controls.</p>
      <h2>Manage Sign in with Apple</h2>
      <p>Deleting Formie does not automatically revoke Apple authorization. You can manage Formie under Apple ID Settings, Sign-In &amp; Security, Sign in with Apple, or visit <a href="https://account.apple.com/">Apple Account</a>. Apple controls its own authorization and retention records.</p>
      <h2>Ask for help</h2>
      <p>If a control is unavailable or you have a privacy question, contact <Link href="/support">Formie support</Link>.</p>
    </LegalPage>
  );
}
