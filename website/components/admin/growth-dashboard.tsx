import { DataTable } from "@/components/reporting/data-table";
import { MetricCard } from "@/components/reporting/metric-card";
import { TrendChart } from "@/components/reporting/trend-chart";
import type { BusinessDashboard } from "@/lib/reporting/contracts";

function Breakdown({ title, rows, valueKey = "users", empty = "No reportable groups meet the five-user privacy threshold." }: { title: string; rows: unknown[]; valueKey?: string; empty?: string }) {
  return <section className="admin-panel admin-breakdown"><h2>{title}</h2>{rows.length ? <ul>{rows.map((value, index) => {
    const row = value as Record<string, unknown>;
    return <li key={index}><span>{String(row.label ?? "Unknown").replaceAll("_", " ")}</span><b>{Number(row[valueKey] ?? 0).toLocaleString()}</b></li>;
  })}</ul> : <p>{empty}</p>}</section>;
}

function RetentionTable({ title, rows }: { title: string; rows: unknown[] }) {
  const percent=(value:unknown)=>typeof value==="number"?`${value.toFixed(1)}%`:"Unavailable";
  const tableRows = rows.map((value) => { const row=value as Record<string,unknown>; return [String(row.label??"Unknown").replaceAll("_"," "),Number(row.users??0).toLocaleString(),`${Number(row.d7Users??0)} / ${Number(row.d7Eligible??0)} (${percent(row.d7Percent)})`,`${Number(row.d30Users??0)} / ${Number(row.d30Eligible??0)} (${percent(row.d30Percent)})`]; });
  return <section className="admin-panel admin-currency-panel"><div className="admin-panel-heading"><div><span className="admin-kicker">Separate mature denominators</span><h2>{title}</h2></div></div><DataTable headings={["Cohort","Selected users","D7 retained / eligible","D30 retained / eligible"]} rows={tableRows} empty="No reportable groups meet the privacy threshold."/></section>;
}

function AnalysisDepthTable({rows}:{rows:unknown[]}) { const tableRows=rows.map((value)=>{const row=value as Record<string,unknown>;return [String(row.label??"Unknown").replaceAll("_"," "),Number(row.users??0).toLocaleString(),`${Number(row.d30Users??0)} / ${Number(row.d30Eligible??0)}`,typeof row.d30Percent==="number"?`${row.d30Percent.toFixed(1)}%`:"Unavailable"]});return <section className="admin-panel admin-currency-panel"><div className="admin-panel-heading"><div><span className="admin-kicker">Observational relationship</span><h2>First-week analysis depth and D30 retention</h2></div></div><DataTable headings={["First 7 days","Users","D30 retained / eligible","D30 retention"]} rows={tableRows} empty="No mature signup cohorts are available."/></section>}

export function GrowthDashboard({ dashboard }: { dashboard: BusinessDashboard }) {
  const funnel = dashboard.growth.onboardingFunnel ?? [];
  const first = Number((funnel[0] as Record<string, unknown> | undefined)?.users ?? 0);
  const screenRows = (dashboard.growth.onboardingScreens ?? []).map((value) => {
    const row = value as Record<string, unknown>;
    const ms = row.averageTransitionMs == null ? "Unavailable" : `${(Number(row.averageTransitionMs) / 1000).toFixed(1)}s`;
    return [String(row.label ?? "Unknown"), Number(row.users ?? 0).toLocaleString(), Number(row.views ?? 0).toLocaleString(), Number(row.exits ?? 0).toLocaleString(), ms];
  });
  const coverageRows = (dashboard.growth.coverage ?? []).map((value) => {
    const row = value as Record<string, unknown>;
    return [String(row.source ?? "Unknown"), String(row.status ?? "unknown"), row.observedSince ? new Date(String(row.observedSince)).toLocaleDateString() : "Unavailable", row.lastSuccessAt ? new Date(String(row.lastSuccessAt)).toLocaleString() : "Unavailable", String(row.detail ?? "")];
  });
  const metricKeys: [string, string][] = [["newUsers", "New users"], ["dau", "Daily active"], ["wau", "Weekly active"], ["mau", "Monthly active"], ["subscriptionConversion", "30-day conversion"], ["clickToSignup", "Code to signup"], ["creatorPaidConversion", "Creator paid conversion"], ["d1Retention", "D1 retention"], ["d7Retention", "D7 retention"], ["d30Retention", "D30 retention"], ["subscriberRetention", "Subscriber retention"], ["processingTime", "Processing time"], ["helpfulRate", "Helpful rate"], ["quotaExhaustion", "Quota exhaustion"]];
  return <>
    <div className="admin-title"><div><span className="admin-kicker">Acquisition and retention</span><h1>How people find and use Formie</h1></div><p>Historical events remain unavailable where collection did not exist. Small demographic groups are suppressed.</p></div>
    <div className="admin-metrics">{metricKeys.map(([key, label]) => <MetricCard key={key} label={label} metric={dashboard.metrics[key]} />)}</div>
    <section className="admin-panel admin-chart-panel"><TrendChart rows={dashboard.trends} valueKey="newUsers" label="New users" /></section>
    <section className="admin-panel admin-funnel-panel"><div className="admin-panel-heading"><div><span className="admin-kicker">Ordered cohort funnel</span><h2>Questionnaire to repeat analysis</h2></div><p>Each stage counts only members of the same signup cohort who reached the prior stage in order.</p></div><div className="admin-funnel">{funnel.map((value, index) => {
      const row = value as Record<string, unknown>; const users = Number(row.users ?? 0); const percent = first ? 100 * users / first : 0;
      return <article key={String(row.label)}><div className="admin-funnel-top"><span>{String(index + 1).padStart(2, "0")}</span><b>{users.toLocaleString()}</b></div><h3>{String(row.label ?? "Unknown").replaceAll("_", " ")}</h3><div className="admin-funnel-track"><i style={{ width: `${percent}%` }} /></div><small>{first ? `${percent.toFixed(1)}% of cohort` : "No observed cohort"}</small></article>;
    })}</div></section>
    <div className="admin-breakdown-grid"><Breakdown title="Self-reported acquisition" rows={dashboard.growth.selfReported ?? []} /><Breakdown title="Verified acquisition" rows={dashboard.growth.verifiedAcquisition ?? []} /><Breakdown title="Age ranges" rows={dashboard.growth.ageRanges ?? []} /><Breakdown title="Gender" rows={dashboard.growth.gender ?? []} /><Breakdown title="Experience" rows={dashboard.growth.experience ?? []} /><Breakdown title="Primary goals" rows={dashboard.growth.goals ?? []} /><Breakdown title="Frustrations" rows={dashboard.growth.frustrations ?? []} /><Breakdown title="Workout frequency" rows={dashboard.growth.workoutFrequency ?? []} /><Breakdown title="Milestone themes" rows={dashboard.growth.milestoneThemes ?? []} /><Breakdown title="Exercise popularity" rows={dashboard.growth.exercisePopularity ?? []} valueKey="analyses" empty="No completed analyses in this range." /><Breakdown title="Analysis outcomes" rows={(dashboard.growth.analysisOutcomes ?? []).map((value)=>{const row=value as Record<string,unknown>;return {...row,attempts:row.attempts??row.users}})} valueKey="attempts" empty="No terminal attempts in this range." /><Breakdown title="Original and reanalysis" rows={(dashboard.growth.reanalysis ?? []).map((value)=>{const row=value as Record<string,unknown>;return {...row,attempts:row.attempts??row.users}})} valueKey="attempts" empty="No attempts in this range." /></div><AnalysisDepthTable rows={dashboard.growth.firstWeekAnalysisDepth??[]}/>
    <div className="admin-chart-grid"><RetentionTable title="Retention by verified acquisition" rows={dashboard.growth.retentionByAcquisition ?? []}/><RetentionTable title="Retention by creator" rows={dashboard.growth.retentionByCreator ?? []}/><RetentionTable title="Retention by experience" rows={dashboard.growth.retentionByExperience ?? []}/><RetentionTable title="Retention by primary goal" rows={dashboard.growth.retentionByGoal ?? []}/></div>
    <section className="admin-panel admin-currency-panel"><div className="admin-panel-heading"><div><span className="admin-kicker">Observational comparison</span><h2>Referral bonus recipients and non-referred paid cohorts</h2></div><p>This describes an association between cohorts. It does not establish that the bonus caused retention or analysis activity.</p></div><DataTable headings={["Cohort","Users","D7 retained / eligible","D30 retained / eligible","Average analyses in mature first 30 days"]} rows={(dashboard.growth.bonusComparison??[]).map((value)=>{const row=value as Record<string,unknown>;return [String(row.label??"Unknown").replaceAll("_"," "),Number(row.users??0).toLocaleString(),`${Number(row.d7Users??0)} / ${Number(row.d7Eligible??0)}${typeof row.d7Percent==="number"?` (${row.d7Percent.toFixed(1)}%)`:""}`,`${Number(row.d30Users??0)} / ${Number(row.d30Eligible??0)}${typeof row.d30Percent==="number"?` (${row.d30Percent.toFixed(1)}%)`:""}`,typeof row.averageFirst30DayAnalyses==="number"?row.averageFirst30DayAnalyses.toFixed(2):"Unavailable"]})} empty="No comparison cohorts meet the privacy threshold."/></section>
    <section className="admin-panel admin-currency-panel"><div className="admin-panel-heading"><div><span className="admin-kicker">Onboarding behavior</span><h2>Screen reach, exits, and transition time</h2></div></div><DataTable headings={["Screen", "People", "Views", "Exits", "Average transition"]} rows={screenRows} empty="No durable onboarding screen events have been observed." /></section>
    <section className="admin-panel admin-currency-panel"><div className="admin-panel-heading"><div><span className="admin-kicker">Observation coverage</span><h2>Source freshness</h2></div></div><DataTable headings={["Source", "Status", "Observed since", "Last success", "Detail"]} rows={coverageRows} empty="No source coverage records are available." /></section>
  </>;
}
