import type { AdminDashboardSnapshot } from "@/lib/admin/dashboard-data";

const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });
const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });

type QualityLabel = "Exact" | "Estimated" | "Incomplete" | "Unavailable";

function MetricCard({ label, value, detail, quality, feature = false }: { label: string; value: string; detail: string; quality: QualityLabel; feature?: boolean }) {
  return (
    <article className={`admin-metric${feature ? " admin-metric-feature" : ""}`}>
      <div className="admin-metric-label"><span>{label}</span><em data-quality={quality.toLowerCase()}>{quality}</em></div>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}

function dateTime(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

function percent(value: number | null) {
  return value === null ? "Unavailable" : `${value.toFixed(1)}%`;
}

function qualityLabel(status: "exact" | "estimated" | "incomplete" | "unavailable"): QualityLabel {
  return `${status[0].toUpperCase()}${status.slice(1)}` as QualityLabel;
}

export function AdminDashboard({ snapshot, adminEmail }: { snapshot: AdminDashboardSnapshot; adminEmail: string }) {
  const m = snapshot.metrics;
  const aiAccuracy = snapshot.accuracy.aiCost;
  const revenueAccuracy = snapshot.accuracy.revenue;
  const aiCoverage = aiAccuracy.coveragePercent === null ? "coverage unavailable" : `${aiAccuracy.coveragePercent.toFixed(1)}% priced`;
  const revenueCoverage = revenueAccuracy.coveragePercent === null ? "no production subscriptions to price" : `${revenueAccuracy.coveragePercent.toFixed(1)}% priced`;
  const cards = [
    ["Total users", compact.format(m.totalUsers), `${m.newUsersToday} joined today`, "Exact"],
    ["Observed daily active", compact.format(m.dau), `${m.wau} observed weekly active`, "Exact"],
    ["Delivered analyses", compact.format(m.totalAnalyses), `${m.analysesToday} delivered today`, "Exact"],
    ["Second analysis rate", percent(m.secondAnalysisRate), "Users with two or more delivered analyses", "Exact", true],
    ["Active paid subscriptions", compact.format(m.payingSubscribers), m.freeToPaidRate === null ? "Ordered purchase conversion unavailable" : `${percent(m.freeToPaidRate)} ordered conversion`, "Exact"],
    ["Gross subscription run rate", m.estimatedMrr === null ? "Unavailable" : money.format(m.estimatedMrr), `${revenueCoverage}; excludes fees, tax, and refunds`, qualityLabel(revenueAccuracy.status)],
    ["Currently cancelling", compact.format(m.cancellations), "Active production plans set not to renew", "Exact"],
    ["Tracked AI cost — minimum", m.aiCostMonth === null ? "Unavailable" : money.format(m.aiCostMonth), `${aiCoverage}; ${aiAccuracy.unpricedCalls} unpriced call${aiAccuracy.unpricedCalls === 1 ? "" : "s"}`, qualityLabel(aiAccuracy.status)],
    ["Analysis success", percent(m.analysisSuccessRate), "Delivered of terminal attempts in 30 days", "Exact"],
    ["Advice rating", m.helpfulRate === null ? "No ratings yet" : percent(m.helpfulRate), `${m.helpfulVotes} helpful · ${m.unhelpfulVotes} not helpful`, "Exact"],
  ] as const;

  return (
    <main className="admin-shell">
      <header className="admin-header">
        <div className="admin-brand"><span className="admin-mark">F</span><div><b>Formie</b><small>Founder dashboard</small></div></div>
        <div className="admin-account"><span>Live production</span><small>{adminEmail}</small><form action="/admin/sign-out" method="post"><button type="submit">Sign out</button></form></div>
      </header>

      <section className="admin-content">
        <div className="admin-title"><div><span className="admin-kicker">Launch control</span><h1>Are people coming, using, and paying?</h1></div><p>Updated {dateTime(snapshot.generatedAt)}. Production billing excludes sandbox and legacy access.</p></div>
        <div className="admin-metrics">{cards.map(([label, value, detail, quality, feature]) => <MetricCard key={label} label={label} value={value} detail={detail} quality={quality} feature={feature} />)}</div>

        <section className="admin-panel admin-funnel-panel">
          <div className="admin-panel-heading"><div><span className="admin-kicker">Ordered cohort</span><h2>Signup to subscriber return</h2></div><p>Each user must reach every prior stage in timestamp order. Observed since {dateTime(snapshot.accuracy.funnel.observedSince)}.</p></div>
          <div className="admin-funnel">
            {snapshot.funnel.map((step, index) => (
              <article key={step.key}>
                <div className="admin-funnel-top"><span>{String(index + 1).padStart(2, "0")}</span><b>{step.users.toLocaleString()}</b></div>
                <h3>{step.label}</h3>
                <div className="admin-funnel-track"><i style={{ width: `${Math.max(0, Math.min(100, step.conversionFromSignup))}%` }} /></div>
                <small>{index === 0 ? "Starting cohort" : `${step.conversionFromPrevious.toFixed(1)}% from previous`}</small>
              </article>
            ))}
          </div>
        </section>

        <div className="admin-tables">
          <section className="admin-panel">
            <div className="admin-panel-heading"><div><span className="admin-kicker">People</span><h2>Recent users</h2></div></div>
            <div className="admin-table-wrap"><table><thead><tr><th>User</th><th>Joined</th><th>Plan</th><th>Analyses</th><th>Last active</th><th>Source</th><th>Status</th></tr></thead><tbody>
              {snapshot.recentUsers.length ? snapshot.recentUsers.map((user) => <tr key={user.id}><td><b>{user.displayName ?? "Unnamed"}</b><small>{user.email}</small></td><td>{dateTime(user.joinedAt)}</td><td>{user.plan}</td><td>{user.analyses}</td><td>{dateTime(user.lastActiveAt)}</td><td>{user.source ?? "Unknown"}</td><td><span className="admin-pill">{user.status}</span></td></tr>) : <tr><td colSpan={7} className="admin-empty">No users yet.</td></tr>}
            </tbody></table></div>
          </section>

          <section className="admin-panel">
            <div className="admin-panel-heading"><div><span className="admin-kicker">Pipeline</span><h2>Recent analyses</h2></div></div>
            <div className="admin-table-wrap"><table><thead><tr><th>User</th><th>Exercise</th><th>Status</th><th>Started</th><th>Processing</th><th>AI cost</th><th>Rating</th></tr></thead><tbody>
              {snapshot.recentAnalyses.length ? snapshot.recentAnalyses.map((analysis) => <tr key={analysis.id}><td>{analysis.userEmail}</td><td><b>{analysis.exercise}</b></td><td><span className="admin-pill">{analysis.status}</span></td><td>{dateTime(analysis.createdAt)}</td><td>{analysis.processingMs === null ? "—" : `${Math.round(analysis.processingMs / 1000)}s`}</td><td>{analysis.aiCost === null ? "Unpriced" : `${money.format(analysis.aiCost)}${analysis.aiCostComplete ? "" : " minimum"}`}</td><td>{analysis.feedback === null ? "—" : analysis.feedback ? "Helpful" : "Not helpful"}</td></tr>) : <tr><td colSpan={7} className="admin-empty">No analyses yet.</td></tr>}
            </tbody></table></div>
          </section>
        </div>
      </section>
    </main>
  );
}
