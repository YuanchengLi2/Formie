import { createServiceClient } from "@/lib/admin/supabase-runtime";
import { CreatorAccessError, requireCreator } from "@/lib/creators/access";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 1_000;
const MAX_EXPORT_ROWS = 100_000;
const csv = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
const response = (body: string, status: number) => new Response(body, { status, headers: { "Cache-Control": "private, no-store" } });

export async function GET() {
  try {
    const { creatorId } = await requireCreator();
    const admin = createServiceClient();
    const { count, error: countError } = await admin
      .from("creator_commission_entries")
      .select("id", { count: "exact", head: true })
      .eq("creator_id", creatorId);
    if (countError) throw countError;
    if ((count ?? 0) > MAX_EXPORT_ROWS) {
      return response("Statement is too large for one export. Contact Formie support for a complete archive.", 413);
    }

    const rows: Record<string, unknown>[] = [];
    for (let offset = 0; offset < (count ?? 0); offset += PAGE_SIZE) {
      const { data, error } = await admin
        .from("creator_commission_entries")
        .select("id,entry_type,amount,currency,status,hold_until,created_at,creator_payout_items(payout_id)")
        .eq("creator_id", creatorId)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .range(offset, Math.min(offset + PAGE_SIZE - 1, (count ?? 0) - 1));
      if (error) throw error;
      rows.push(...((data ?? []) as Record<string, unknown>[]));
    }
    if (rows.length !== (count ?? 0)) throw new Error("Statement ledger changed during export; retry the download.");
    const payoutIds = [...new Set(rows.flatMap((row) => Array.isArray(row.creator_payout_items)
      ? row.creator_payout_items.map((item) => String((item as { payout_id?: unknown }).payout_id ?? "")).filter(Boolean)
      : []))];
    const paidAtByPayout = new Map<string, string | null>();
    if (payoutIds.length) {
      const { data: payouts, error: payoutError } = await admin
        .from("creator_payouts")
        .select("id,paid_at")
        .eq("creator_id", creatorId)
        .in("id", payoutIds);
      if (payoutError) throw payoutError;
      for (const payout of payouts ?? []) paidAtByPayout.set(String(payout.id), payout.paid_at);
    }

    const lines = [
      ["Entry ID", "Type", "Amount", "Currency", "Status", "Created", "Hold until", "Paid", "Payout ID"].map(csv).join(","),
      ...rows.map((row) => [
        row.id,
        row.entry_type,
        row.amount,
        row.currency,
        row.status,
        row.created_at,
        row.hold_until,
        (() => {
          const payoutId = Array.isArray(row.creator_payout_items) ? String((row.creator_payout_items[0] as { payout_id?: unknown } | undefined)?.payout_id ?? "") : "";
          return payoutId ? paidAtByPayout.get(payoutId) ?? "" : "";
        })(),
        Array.isArray(row.creator_payout_items) ? (row.creator_payout_items[0] as { payout_id?: unknown } | undefined)?.payout_id : "",
      ].map(csv).join(",")),
    ];
    return new Response(lines.join("\r\n"), { headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=formie-creator-statement.csv",
      "Cache-Control": "private, no-store",
    } });
  } catch (error) {
    return error instanceof CreatorAccessError ? response("Unauthorized", 401) : response("Statement is temporarily unavailable", 503);
  }
}
