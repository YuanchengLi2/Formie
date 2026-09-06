import type { ReactNode } from "react";
export function DataTable({ headings, rows, empty }: { headings: string[]; rows: ReactNode[][]; empty: string }) {
  return <div className="admin-table-wrap"><table><thead><tr>{headings.map((heading)=><th key={heading}>{heading}</th>)}</tr></thead><tbody>{rows.length ? rows.map((row,index)=><tr key={index}>{row.map((cell,cellIndex)=><td key={cellIndex}>{cell}</td>)}</tr>) : <tr><td colSpan={headings.length} className="admin-empty">{empty}</td></tr>}</tbody></table></div>;
}
