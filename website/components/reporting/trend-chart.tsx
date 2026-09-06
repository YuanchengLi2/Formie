export function TrendChart({ rows, valueKey, label }: { rows: Record<string, string | number | null>[]; valueKey: string; label: string }) {
  const values = rows.map((row) => Number(row[valueKey] ?? 0));
  if (values.length === 0) return <div className="admin-empty-state">No reliable trend observations are available for this period.</div>;
  const max = Math.max(1, ...values); const points = values.map((value,index) => `${values.length===1?50:(index/(values.length-1))*100},${40-(value/max)*36}`).join(" ");
  return <figure className="admin-chart" aria-label={label}><svg viewBox="0 0 100 44" preserveAspectRatio="none"><polyline fill="none" stroke="currentColor" strokeWidth="1.4" points={points} /></svg><figcaption>{label} · {rows.length} daily observations</figcaption></figure>;
}
