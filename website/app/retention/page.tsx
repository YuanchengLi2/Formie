import type { Metadata } from "next";
import Link from "next/link";

import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = { title: "Retention Policy", alternates: { canonical: "/retention" } };

export default function RetentionPage() {
  return (
    <LegalPage eyebrow="Your data" title="Retention Policy" updated="August 10, 2026">
      <p>This policy explains when Formie keeps or deletes account, recording, and analysis data. It supplements the <Link href="/privacy">Privacy Policy</Link>.</p>
      <h2>Account and analysis history</h2>
      <p>Your account and saved analysis history remain available unless you delete eligible data, request account deletion, or a retention setting described below applies. Canceling a subscription does not delete your account or change the current paid-through period.</p>
      <h2>Optional 30-day analysis cleanup</h2>
      <p>When the 30-day video retention option is enabled for your account, Formie schedules eligible server-side analyses created on or after that setting&apos;s effective date for deletion after they become 30 days old. The cleanup removes the eligible analysis session and its associated stored video, thumbnails, and processing artifacts.</p>
      <p>Analyses created before the effective date are not automatically included in that scheduled cleanup. If the option is not enabled, the scheduled 30-day cleanup does not apply.</p>
      <h2>Copies on your device</h2>
      <p>Local device copies are separate from server-side data. Removing server data does not remove a recording you kept in Photos, Files, a device backup, or another app; you must manage those local copies on the device or service where they are stored.</p>
      <h2>Operational and legal records</h2>
      <p>Service providers may retain transient processing copies under their own contractual deletion schedules. Formie may also keep limited billing, security, support, fraud-prevention, backup, or legal records for as long as reasonably needed to operate the service, resolve disputes, or comply with law.</p>
      <h2>Your choices</h2>
      <p>You can review available retention controls in Formie and contact <Link href="/support">support</Link> with a deletion or retention question.</p>
    </LegalPage>
  );
}
