import Link from "next/link";

import { CreatorShell } from "@/components/creators/creator-dashboard";
import { loadCreatorDashboard } from "@/lib/creators/load-dashboard";
import { redirectCreatorLogin } from "@/lib/creators/access";
import { parseDashboardRange, type DashboardSearchParams } from "@/lib/reporting/filters";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<DashboardSearchParams & { page?: string }> }) {
  const params = await searchParams;
  const range = parseDashboardRange(params);
  const requestedPage = Number(params.page ?? "1");
  const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  let data;
  try { data = await loadCreatorDashboard(range.window, page, 50, range.start, range.end); }
  catch (error) { redirectCreatorLogin(error); }
  const pageHref = (target: number) => {
    const query = new URLSearchParams({ page: String(target), window: range.window });
    if (range.start) query.set("start", range.start);
    if (range.end) query.set("end", range.end);
    return `/creators/referrals?${query.toString()}`;
  };
  return <CreatorShell data={data} active="referrals"><div className="creator-hero"><span>Referrals</span><h1>Attributed accounts</h1><p>Identifiers are pseudonymous. Personal onboarding answers and exercise activity are never included.</p></div><div className="creator-table"><table><thead><tr><th>Referral</th><th>Signup</th><th>First paid</th><th>Commission</th><th>Amount</th></tr></thead><tbody>{data.referrals.length ? data.referrals.map((row) => <tr key={row.id}><td>{row.id}</td><td>{new Date(row.signedUpAt).toLocaleDateString()}</td><td>{row.paidAt ? new Date(row.paidAt).toLocaleDateString() : "Not converted"}</td><td>{row.commissionStatus ?? "Not accrued"}</td><td>{row.commissionAmount != null && row.commissionCurrency ? new Intl.NumberFormat("en-US", { style: "currency", currency: row.commissionCurrency }).format(row.commissionAmount) : "—"}</td></tr>) : <tr><td colSpan={5}>No attributed accounts in this range.</td></tr>}</tbody></table></div><nav aria-label="Referral pages" className="creator-pagination">{page > 1 ? <Link href={pageHref(page - 1)}>Previous</Link> : <span>Previous</span>}<small>{data.referralPagination.total ? `${data.referralPagination.offset + 1}–${Math.min(data.referralPagination.offset + data.referralPagination.limit, data.referralPagination.total)} of ${data.referralPagination.total}` : "0 referrals"}</small>{data.referralPagination.hasMore ? <Link href={pageHref(page + 1)}>Next</Link> : <span>Next</span>}</nav></CreatorShell>;
}
