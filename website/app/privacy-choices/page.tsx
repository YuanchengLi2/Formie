import type { Metadata } from "next";
import Link from "next/link";

import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Privacy Choices",
  alternates: { canonical: "/privacy-choices" },
};

export default function PrivacyChoicesPage() {
  return (
    <LegalPage eyebrow="Your controls" title="Privacy Choices" updated="September 1, 2026">
      <p>These controls let you manage Formie data and the separate Apple services connected to the app. For timing and exceptions, see the <Link href="/retention">Retention Policy</Link> and <Link href="/privacy">Privacy Policy</Link>.</p>
      <h2>Delete your Formie account</h2>
      <p>In the app, open Settings &gt; Delete Account, review what will be removed, type DELETE, and choose Delete Account Now. You can delete immediately even with an active subscription. Formie does not require you to cancel Apple billing first.</p>
      <h2>Delete an analysis</h2>
      <p>Open an analysis in Formie and use its delete action to remove that analysis, its eligible server-side recording and artifacts, and its stored Gemini file. Temporary processor failures are placed in Formie&apos;s encrypted deletion queue.</p>
      <h2>Withdraw AI processing consent</h2>
      <p>Open Settings &gt; AI Processing and choose Withdraw consent. Withdrawal immediately blocks new analyses, reanalyses, and provider retries that have not begun. It does not erase completed results; use the analysis or account deletion controls for that.</p>
      <h2>Manage Apple billing</h2>
      <p>Deleting Formie data does not cancel an Apple subscription. Use Manage Apple Subscription in the deletion dialog or Settings &gt; Subscription in Formie to open Apple&apos;s subscription controls.</p>
      <h2>Manage Sign in with Apple</h2>
      <p>Formie automatically revokes its stored Sign in with Apple authorization during account deletion or places a temporary failure in its encrypted deletion queue. A legacy Apple account without a stored revocation token is asked to use the official Apple sign-in control once before retrying deletion. Apple controls its own account and billing records.</p>
      <h2>Ask for help</h2>
      <p>If a control is unavailable or you have a privacy question, contact <Link href="/support">Formie support</Link>.</p>
    </LegalPage>
  );
}
