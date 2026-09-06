"use client";

import Link from "next/link";
import { useActionState } from "react";

import { createCreator, updateCreator, type CreatorActionState } from "@/app/admin/creators/actions";
import { DataTable } from "@/components/reporting/data-table";
import { MetricCard } from "@/components/reporting/metric-card";
import type { BusinessDashboard } from "@/lib/reporting/contracts";

export function CreatorManagement({ dashboard, settings }: { dashboard: BusinessDashboard; settings: { issuanceEnabled: boolean; rewardsEnabled: boolean; updatedAt: string } }) {
  const [state, action, pending] = useActionState(createCreator, { ok: false, message: "" } satisfies CreatorActionState);
  const [settingsState, settingsAction, settingsPending] = useActionState(updateCreator, { ok: false, message: "" } satisfies CreatorActionState);
  const usd = (value: unknown) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(value ?? 0));
  const rows = dashboard.creators.map((creator) => {
    const accounts = Number(creator.accounts ?? 0);
    const paid = Number(creator.paid ?? 0);
    return [
      <Link key={String(creator.id)} href={`/admin/creators/${String(creator.id)}`}>{String(creator.displayName)}</Link>,
      String(creator.slug ?? "").toUpperCase(),
      String(creator.linkStatus ?? creator.status),
      `${Number(creator.rateBasisPoints ?? 0) / 100}%`,
      Number(creator.visits ?? 0).toLocaleString(),
      Number(creator.recovered ?? 0).toLocaleString(),
      Number(creator.pendingVisits ?? 0).toLocaleString(),
      Number(creator.expiredUnmatchedVisits ?? 0).toLocaleString(),
      Number(creator.excludedRequests ?? 0).toLocaleString(),
      accounts.toLocaleString(),
      paid.toLocaleString(),
      accounts ? `${(100 * paid / accounts).toFixed(1)}%` : "Unavailable",
      usd(creator.grossRevenue),
      usd(creator.commission),
      usd(creator.pending),
      usd(creator.payable),
      usd(creator.paidAmount),
      Number(creator.bonusRecipients ?? 0).toLocaleString(),
      Number(creator.bonusUsed ?? 0).toLocaleString(),
      usd(creator.bonusAiCost),
    ];
  });

  return <>
    <div className="admin-title"><div><span className="admin-kicker">Creator program</span><h1>Codes, conversions, bonuses, and payouts</h1></div><p>Rates shown here apply only to future attributed accounts. Each account retains its locked rate.</p></div>
    <div className="admin-metrics">{[["clickToSignup", "Code to signup"], ["creatorPaidConversion", "Paid conversion"], ["pendingReferralVisits", "Validated, not signed up"], ["expiredUnmatchedVisits", "Expired unclaimed"], ["excludedReferralRequests", "Legacy link exclusions"], ["bonusGranted", "Bonus units granted"], ["bonusUsed", "Bonus units used"], ["bonusExpired", "Bonus units expired"], ["bonusRevoked", "Bonus units revoked"], ["creatorCommissions", "Creator commissions"], ["commissionPending", "Commission pending"], ["commissionPayable", "Commission payable"], ["commissionPaid", "Commission paid"], ["referralRevenue", "Referral revenue"], ["bonusAiCost", "Bonus AI cost"]].map(([key, label]) => <MetricCard key={key} label={label} metric={dashboard.metrics[key]} />)}</div>
    <section className="admin-panel admin-action-panel"><form action={settingsAction}><input type="hidden" name="intent" value="program_settings"/><label><input name="issuanceEnabled" type="checkbox" defaultChecked={settings.issuanceEnabled}/>Accept new creator codes</label><label><input name="rewardsEnabled" type="checkbox" defaultChecked={settings.rewardsEnabled}/>Lock reward eligibility on new attributions</label><button disabled={settingsPending} type="submit">Save rollout settings</button></form><p>Both settings are server-owned. Existing locked eligibility, grants, and earnings are preserved when new code validation is paused.</p>{settingsState.message ? <p role="status">{settingsState.message}</p> : null}</section>
    <section className="admin-panel admin-action-panel"><form action={action}><label>Display name<input required name="displayName" minLength={2} maxLength={80}/></label><label>Portal email<input required name="email" type="email"/></label><label>Commission %<input required name="ratePercent" type="number" min="0" max="20" step="0.01" defaultValue="15"/></label><button disabled={pending} type="submit">{pending ? "Creating…" : "Add creator and create invitation"}</button></form>{state.message ? <p role="status">{state.message}</p> : null}{state.invitationUrl ? <label className="admin-invite-result">Invitation link<input readOnly value={state.invitationUrl}/></label> : null}</section>
    <section className="admin-panel"><div className="admin-panel-heading"><div><span className="admin-kicker">All creators</span><h2>Program performance</h2></div></div><DataTable headings={["Creator", "Code", "Code status", "Rate", "Validations", "Confirmed", "Pending", "Expired unclaimed", "Legacy exclusions", "Accounts", "First paid", "Paid conversion", "Referral gross USD", "Commission USD", "Pending USD", "Payable USD", "Paid USD", "Bonus recipients", "Bonus used", "Bonus AI USD"]} rows={rows} empty="No creators have been provisioned."/></section>
  </>;
}
