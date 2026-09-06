"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import type { CreatorDashboardData } from "@/lib/creators/load-dashboard";
import type { Metric } from "@/lib/reporting/contracts";

function money(value: number, currency: string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(value);
}

function metricValue(metric: Metric): string {
  if (metric.value === null) return "Unavailable";
  if (metric.unit === "percent") return `${metric.value.toFixed(1)}%`;
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(metric.value);
}

function CreatorMetric({ label, metric }: { label: string; metric: Metric }) {
  return <article title={metric.definition}><div><small>{label}</small><em data-quality={metric.quality}>{metric.quality}</em></div><strong>{metricValue(metric)}</strong>{metric.observedSince ? <span>Observed since {new Date(metric.observedSince).toLocaleDateString()}</span> : null}</article>;
}

export function CreatorShell({ data, active, children }: { data: CreatorDashboardData; active: "overview" | "referrals" | "earnings" | "account"; children: ReactNode }) {
  const filterVisible=active!=="account";
  return <main className="creator-shell"><header><Link href="/creators" className="creator-brand"><span>F</span><div><b>Formie creators</b><small>{data.creator.displayName}</small></div></Link><nav>{[["overview", "/creators"], ["referrals", "/creators/referrals"], ["earnings", "/creators/earnings"], ["account", "/creators/account"]].map(([label, href]) => <Link data-active={active === label} key={label} href={href}>{label}</Link>)}</nav></header><section className="creator-content">{filterVisible?<form className="creator-filter" method="get"><label>Range<select defaultValue={data.window} name="window"><option value="24h">Today</option><option value="7d">7 days</option><option value="30d">30 days</option><option value="90d">90 days</option><option value="all">All time</option><option value="custom">Custom</option></select></label><label>Start<input defaultValue={data.window==="custom"?data.rangeStart?.slice(0,10):""} name="start" type="date"/></label><label>End<input defaultValue={data.window==="custom"?data.rangeEnd.slice(0,10):""} name="end" type="date"/></label><button type="submit">Apply</button></form>:null}{children}</section></main>;
}

export function EarningsBalances({ data }: { data: CreatorDashboardData }) {
  if (!data.earningsByCurrency.length) return <p className="creator-empty">No commission entries yet. Currency balances appear after a referred subscriber’s first successful payment.</p>;
  return <div className="creator-balance-grid">{data.earningsByCurrency.map((row) => <section key={row.currency}><div><small>{row.currency} pending</small><strong>{money(row.pending, row.currency)}</strong></div><div><small>Payable</small><strong>{money(row.payable, row.currency)}</strong></div><div><small>Paid</small><strong>{money(row.paid, row.currency)}</strong></div><div><small>Adjustments</small><strong>{money(row.adjustments, row.currency)}</strong></div></section>)}</div>;
}

export function CreatorDashboard({ data }: { data: CreatorDashboardData }) {
  const m = data.metrics;
  return <><div className="creator-hero"><span>Creator overview</span><h1>Your referrals and first-payment earnings</h1><p>Your locked rate is {data.creator.rateBasisPoints / 100}%. Commission applies to a referred subscriber’s first successful payment only and uses reconciled net proceeds.</p></div><section className="creator-link"><div><small>Your permanent creator code · {data.creator.status}</small><strong>{data.creator.creatorCode}</strong></div><button onClick={() => navigator.clipboard.writeText(data.creator.creatorCode)}>Copy creator code</button></section><div className="creator-metrics"><CreatorMetric label="Code validations" metric={m.visits!}/><CreatorMetric label="Validated codes" metric={m.recovered!}/><CreatorMetric label="Attributed accounts" metric={m.accounts!}/><CreatorMetric label="First paid conversions" metric={m.paid!}/><CreatorMetric label="Paid conversion" metric={m.paidConversion!}/><CreatorMetric label="Bonus recipients" metric={m.bonusRecipients!}/></div><div className="creator-section-heading"><span>Earnings by currency</span><h2>Pending, payable, paid, and adjustments</h2><p>Pending entries stay on hold for at least 30 days and require accepted financial reconciliation before payout.</p></div><EarningsBalances data={data} /></>;
}
