import type { Metadata } from "next";
import Link from "next/link";
import { DownloadButton, SiteShell } from "../../components/site-shell";

export const metadata: Metadata = {
  title: "Access",
  description: "Open the Formie app, creator portal, or founder dashboard.",
};

const accessPoints = [
  {
    eyebrow: "Customers",
    title: "Formie app",
    body: "Customers sign in inside the app with Apple. Your account, subscription, analyses, and coaching stay together there.",
    action: <DownloadButton />,
  },
  {
    eyebrow: "Invited creators",
    title: "Creator portal",
    body: "View referral performance, attributed customers, and earnings using the creator account from your Formie invitation.",
    action: <Link className="button" href="/creators/login">Creator sign in</Link>,
  },
  {
    eyebrow: "Private access",
    title: "Founder dashboard",
    body: "Open Formie operations, creator management, referral reporting, and product analytics with an authorized founder account.",
    action: <Link className="button" href="/admin/login">Founder sign in</Link>,
  },
];

export default function LoginDirectoryPage() {
  return (
    <SiteShell>
      <section className="access-directory">
        <div className="access-directory-intro">
          <span className="eyebrow">Formie access</span>
          <h1>Choose where you sign in.</h1>
          <p>Each Formie account type has its own secure access point. Select the one that matches how you use Formie.</p>
        </div>

        <div className="access-directory-grid">
          {accessPoints.map((accessPoint) => (
            <article key={accessPoint.title}>
              <span>{accessPoint.eyebrow}</span>
              <h2>{accessPoint.title}</h2>
              <p>{accessPoint.body}</p>
              <div>{accessPoint.action}</div>
            </article>
          ))}
        </div>

        <p className="access-directory-note">
          Creator access is invite-only. Founder access is restricted to authorized Formie administrators.
        </p>
      </section>
    </SiteShell>
  );
}
