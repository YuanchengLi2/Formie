import type { AdminDashboardSnapshot } from "@/lib/admin/dashboard-data";

const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });
const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });

function MetricCard({ label, value, detail, feature = false }: { label: string; value: string; detail: string; feature?: boolean }) {
  return (
    <article className={`admin-metric${feature ? " admin-metric-feature" : ""}`}>
      <span>{label}</span>
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
  return value === null ? "No ratings yet" : `${value.toFixed(1)}%`;
}

export function AdminDashboard({ snapshot, adminEmail }: { snapshot: AdminDashboardSnapshot; adminEmail: string }) {
  const m = snapshot.metrics;
  const cards = [
    ["Total users", compact.format(m.totalUsers), `${m.newUsersToday} joined today`],
    ["Daily active", compact.format(m.dau), `${m.wau} weekly active`],
    ["Total analyses", compact.format(m.totalAnalyses), `${m.analysesToday} completed today`],
    ["Second analysis rate", percent(m.secondAnalysisRate), "Users who returned for analysis two", true],
    ["Paying users", compact.format(m.payingSubscribers), `${percent(m.freeToPaidRate)} first-analysis to paid`],
    ["Estimated MRR", money.format(m.estimatedMrr), "Monthly production subscriptions only"],
    ["Cancellations", compact.format(m.cancellations), "Active plans set not to renew"],
    ["AI cost", money.format(m.aiCostMonth), "Current calendar month"],
    ["Analysis success", percent(m.analysisSuccessRate), "Delivered of terminal attempts"],
    ["Advice rating", percent(m.helpfulRate), `${m.helpfulVotes} helpful · ${m.unhelpfulVotes} not helpful`],
  ] as const;

  return (
    <main className="admin-shell">
      <header className="admin-header">
        <div className="admin-brand"><span className="admin-mark">F</span><div><b>Formie</b><small>Founder dashboard</small></div></div>
        <div className="admin-account"><span>Live production</span><small>{adminEmail}</small><form action="/admin/sign-out" method="post"><button type="submit">Sign out</button></form></div>
      </header>

      <section className="admin-content">
        <div className="admin-title"><div><span className="admin-kicker">Launch control</span><h1>Are people coming, using, and paying?</h1></div><p>Updated {dateTime(snapshot.generatedAt)}. Production billing excludes sandbox and legacy access.</p></div>
        <div className="admin-metrics">{cards.map(([label, value, detail, feature]) => <MetricCard key={label} label={label} value={value} detail={detail} feature={feature} />)}</div>

        <section className="admin-panel admin-funnel-panel">
          <div className="admin-panel-heading"><div><span className="admin-kicker">Core funnel</span><h2>Signup to second analysis</h2></div><p>Counts unique users. Each percentage compares with the immediately previous stage.</p></div>
          <div className="admin-funnel">
            {snapshot.funnel.map((step, index) => (
              <article key={step.key}>
                <div className="admin-funnel-top"><span>{String(index + 1).padStart(2, "0")}</span><b>{step.users.toLocaleString()}</b></div>
                <h3>{step.label}</h3>
                <div className="admin-funnel-track"><i style={{ width: `${Math.max(2, Math.min(100, step.conversionFromSignup))}%` }} /></div>
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
              {snapshot.recentAnalyses.length ? snapshot.recentAnalyses.map((analysis) => <tr key={analysis.id}><td>{analysis.userEmail}</td><td><b>{analysis.exercise}</b></td><td><span className="admin-pill">{analysis.status}</span></td><td>{dateTime(analysis.createdAt)}</td><td>{analysis.processingMs === null ? "—" : `${Math.round(analysis.processingMs / 1000)}s`}</td><td>{money.format(analysis.aiCost)}</td><td>{analysis.feedback === null ? "—" : analysis.feedback ? "Helpful" : "Not helpful"}</td></tr>) : <tr><td colSpan={7} className="admin-empty">No analyses yet.</td></tr>}
            </tbody></table></div>
          </section>
        </div>
      </section>
    </main>
  );
}
