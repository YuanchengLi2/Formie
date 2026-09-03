import type { Metadata } from "next";
import Link from "next/link";

import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = { title: "Retention Policy", alternates: { canonical: "/retention" } };

export default function RetentionPage() {
  return (
    <LegalPage eyebrow="Your data" title="Retention Policy" updated="September 1, 2026">
      <p>This policy explains when Formie keeps or deletes account, recording, and analysis data. It supplements the <Link href="/privacy">Privacy Policy</Link>.</p>
      <h2>Permanent account deletion</h2>
      <p>Use Settings &gt; Delete Account in the Formie app and type DELETE. Formie permanently deletes its copy of your account after requesting Sign in with Apple revocation, Gemini file deletion, and RevenueCat customer deletion; provider failures enter an encrypted retry queue instead of blocking deletion. Formie then removes account-owned database data and private storage. A legacy Apple account without a stored revocation credential is still deleted and can remove Formie manually in Apple Settings. You may delete your account even if a subscription remains active. Account deletion does not cancel your Apple subscription.</p>
      <h2>Individual analysis deletion</h2>
      <p>You can delete an analysis from its in-app menu without deleting your entire account. That individual control removes the eligible server-side analysis and associated stored video and processing artifacts.</p>
      <h2>Optional 30-day analysis cleanup</h2>
      <p>When the 30-day video retention option is enabled for your account, Formie schedules eligible server-side analyses created on or after that setting&apos;s effective date for deletion after they become 30 days old. The cleanup removes the eligible analysis session and its associated stored video, thumbnails, and processing artifacts.</p>
      <p>Analyses created before the effective date are not automatically included in that scheduled cleanup. If the option is not enabled, the scheduled 30-day cleanup does not apply.</p>
      <h2>Copies on your device</h2>
      <p>Local device copies are separate from server-side data. Removing server data does not remove a recording you kept in Photos, Files, a device backup, or another app; you must manage those local copies on the device or service where they are stored.</p>
      <h2>YouTube tutorial cache</h2>
      <p>Formie&apos;s global, non-user-linked YouTube tutorial cache is revalidated within 24 hours and refreshed or deleted before 30 days. Formie does not send recordings, Formie user IDs, profile data, or free text to YouTube.</p>
      <h2>Operational and legal records</h2>
      <p>Google may retain limited paid Gemini service data for abuse and safety monitoring under its terms. Encrypted processor-deletion jobs are removed after success and expire after no more than 30 days; terminal failures are restricted for operational alerting. Formie may keep limited payment, security, support, fraud-prevention, backup, or legal records only as reasonably needed to operate the service, resolve disputes, or comply with law.</p>
      <h2>Your choices</h2>
      <p>Review all direct controls on the <Link href="/privacy-choices">Privacy Choices</Link> page or contact <Link href="/support">support</Link> with a deletion or retention question.</p>
    </LegalPage>
  );
}
