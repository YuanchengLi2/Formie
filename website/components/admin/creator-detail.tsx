"use client";

import { useActionState } from "react";
import Link from "next/link";
import { updateCreator, type CreatorActionState } from "@/app/admin/creators/actions";
import { DataTable } from "@/components/reporting/data-table";

type Row = Record<string, unknown>;

function records(value: unknown): Row[] {
  return Array.isArray(value) ? value.filter((item): item is Row => Boolean(item) && typeof item === "object" && !Array.isArray(item)) : [];
}

function money(value: unknown, currency: string): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(Number(value ?? 0));
}

export function CreatorDetail({ creator, page }: { creator: Row; page: number }) {
  const [state, action, pending] = useActionState(updateCreator, { ok: false, message: "" } satisfies CreatorActionState);
  const status = String(creator.linkStatus ?? creator.status);
  const creatorId = String(creator.id);
  const code = String(creator.slug).toUpperCase();
  const payouts = records(creator.payouts);
  const balances = records(creator.earningsByCurrency);
  const memberships = records(creator.memberships);
  const referrals = records(creator.referrals);
  const pagination = creator.referralPagination as Row | undefined;
  const today = new Date().toISOString().slice(0, 10);

  return <>
    <div className="admin-title"><div><span className="admin-kicker">Creator detail</span><h1>{String(creator.displayName)}</h1></div><p>Attribution and financial records use pseudonymous account references.</p></div>
    <section className="admin-panel admin-detail-grid">
      <article><small>Creator code</small><strong>{code}</strong><button type="button" onClick={() => navigator.clipboard.writeText(code)}>Copy creator code</button></article>
      <article><small>Validations / confirmed</small><strong>{Number(creator.visits ?? 0)} / {Number(creator.recovered ?? 0)}</strong></article>
      <article><small>Attributed / first paid</small><strong>{Number(creator.accounts ?? 0)} / {Number(creator.paid ?? 0)}</strong></article>
      <article><small>Legacy link exclusions</small><strong>{Number(creator.excludedRequests ?? 0)}</strong></article>
    </section>
    <section className="admin-panel admin-action-panel">
      <form action={action}><input type="hidden" name="creatorId" value={creatorId}/><input type="hidden" name="intent" value={status === "active" ? "pause" : "resume"}/><button disabled={pending} type="submit">{status === "active" ? "Pause creator code" : "Resume creator code"}</button></form>
      <form action={action}><input type="hidden" name="creatorId" value={creatorId}/><input type="hidden" name="intent" value="rate"/><label>Future commission %<input name="ratePercent" type="number" min="0" max="20" step=".01" defaultValue={Number(creator.rateBasisPoints ?? 0) / 100}/></label><button disabled={pending} type="submit">Update future rate</button></form>
      {memberships.map((membership) => <form action={action} key={String(membership.userId)}><input type="hidden" name="creatorId" value={creatorId}/><input type="hidden" name="intent" value="membership"/><input type="hidden" name="memberUserId" value={String(membership.userId)}/><input type="hidden" name="membershipStatus" value={membership.status === "active" ? "revoked" : "active"}/><button disabled={pending} type="submit">{membership.status === "active" ? "Revoke portal access" : "Restore portal access"}</button></form>)}
      {balances.filter((row) => Number(row.payable ?? 0) > 0).map((row) => <form action={action} key={String(row.currency)}><input type="hidden" name="creatorId" value={creatorId}/><input type="hidden" name="intent" value="prepare_payout"/><input type="hidden" name="currency" value={String(row.currency)}/><button disabled={pending}>Prepare {money(row.payable, String(row.currency))} payout</button></form>)}
      {payouts.filter((row) => row.status === "prepared").map((row) => <form action={action} key={String(row.id)}><input type="hidden" name="creatorId" value={creatorId}/><input type="hidden" name="intent" value="mark_paid"/><input type="hidden" name="payoutId" value={String(row.id)}/><label>Payment date<input required max={today} name="paidDate" type="date" defaultValue={today}/></label><label>External reference<input required minLength={2} name="externalReference"/></label><button disabled={pending}>Mark {money(row.amount, String(row.currency))} paid</button></form>)}
      {state.message ? <p role="status">{state.message}</p> : null}
    </section>
    <section className="admin-panel"><div className="admin-panel-heading"><div><span className="admin-kicker">Native currency ledger</span><h2>Earnings and payouts</h2></div></div><DataTable headings={["Currency","Pending","Payable","Paid","Adjustments"]} rows={balances.map((row) => [String(row.currency),money(row.pending,String(row.currency)),money(row.payable,String(row.currency)),money(row.paid,String(row.currency)),money(row.adjustments,String(row.currency))])} empty="No creator commission entries yet."/></section>
    <section className="admin-panel"><div className="admin-panel-heading"><div><span className="admin-kicker">Pseudonymous timeline</span><h2>Attributed accounts</h2></div></div><DataTable headings={["Referral","Signup","First payment","Commission","Bonus"]} rows={referrals.map((row) => [String(row.id),new Date(String(row.signedUpAt)).toLocaleDateString(),row.paidAt ? new Date(String(row.paidAt)).toLocaleDateString() : "Not paid",row.commissionAmount == null ? "Not accrued" : `${money(row.commissionAmount,String(row.commissionCurrency))} · ${String(row.commissionStatus)}`,String(row.bonusState ?? "pending payment")])} empty="No attributed accounts yet."/><nav className="admin-pagination" aria-label="Creator referral pages">{page>1?<Link href={`?page=${page-1}`}>Previous</Link>:<span/>}<span>Page {page} · {Number(pagination?.total??0).toLocaleString()} referrals</span>{pagination?.hasMore?<Link href={`?page=${page+1}`}>Next</Link>:<span/>}</nav></section>
  </>;
}
