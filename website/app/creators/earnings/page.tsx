import { CreatorShell, EarningsBalances } from "@/components/creators/creator-dashboard";
import { loadCreatorDashboard } from "@/lib/creators/load-dashboard";
import { redirectCreatorLogin } from "@/lib/creators/access";
import { parseDashboardRange, type DashboardSearchParams } from "@/lib/reporting/filters";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<DashboardSearchParams> }) {
  const range = parseDashboardRange(await searchParams);
  let data;
  try { data = await loadCreatorDashboard(range.window, 1, 50, range.start, range.end); }
  catch (error) { redirectCreatorLogin(error); }
  return <CreatorShell data={data} active="earnings"><div className="creator-hero"><span>Earnings</span><h1>Payout ledger</h1><p>Accruals become payable after the 30-day hold and approved financial reconciliation. Refunds can create adjustments, including negative balances after a payout.</p></div><EarningsBalances data={data} /><a className="creator-download" href="/creators/earnings/statement">Download full CSV statement</a><div className="creator-table"><table><thead><tr><th>Payout</th><th>Currency</th><th>Amount</th><th>Status</th><th>Prepared</th><th>Paid</th></tr></thead><tbody>{data.payouts.length ? data.payouts.map((row) => <tr key={row.id}><td>{row.id.slice(0, 8)}</td><td>{row.currency}</td><td>{new Intl.NumberFormat("en-US", { style: "currency", currency: row.currency }).format(row.amount)}</td><td>{row.status}</td><td>{new Date(row.preparedAt).toLocaleDateString()}</td><td>{row.paidAt ? new Date(row.paidAt).toLocaleDateString() : "—"}</td></tr>) : <tr><td colSpan={6}>No payout batches yet.</td></tr>}</tbody></table></div></CreatorShell>;
}
