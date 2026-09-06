"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/admin/require-admin";
import { createServiceClient } from "@/lib/admin/supabase-runtime";
import { parseAppleFinancialReport } from "@/lib/revenue/apple-financials";

export type RevenueActionState = { ok: boolean; message: string; importId?: string };

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function importAppleReport(
  _previous: RevenueActionState,
  formData: FormData,
): Promise<RevenueActionState> {
  try {
    const { user } = await requireAdmin();
    const file = formData.get("report");
    if (!(file instanceof File) || file.size === 0 || file.size > 5_000_000) {
      return { ok: false, message: "Choose an Apple report up to 5 MB." };
    }
    const bytes = Buffer.from(await file.arrayBuffer());
    const hash = createHash("sha256").update(bytes).digest("hex");
    const report = parseAppleFinancialReport(bytes.toString("utf8"));
    const admin = createServiceClient();
    const path = `${report.fiscalPeriodStart}_${report.fiscalPeriodEnd}/${hash}.txt`;
    const bucket = process.env.APPLE_FINANCIAL_REPORT_BUCKET ?? "apple-financial-reports";
    const { error: storageError } = await admin.storage.from(bucket).upload(path, bytes, {
      contentType: "text/tab-separated-values",
      upsert: false,
    });
    if (storageError && !/already exists/i.test(storageError.message)) throw storageError;
    const lines = report.lines.map((line) => ({
      line_number: line.lineNumber,
      transaction_date: line.transactionDate,
      settlement_date: line.settlementDate,
      sku: line.sku,
      product_type_identifier: line.productTypeIdentifier,
      country_of_sale: line.countryOfSale,
      quantity: line.quantity,
      sale_or_return: line.saleOrReturn,
      partner_share: line.partnerShare,
      extended_partner_share: line.extendedPartnerShare,
      partner_share_currency: line.partnerShareCurrency,
      customer_price: line.customerPrice,
      customer_currency: line.customerCurrency,
    }));
    const { data, error } = await admin.rpc("import_and_reconcile_apple_financial_report", {
      p_file_sha256: hash,
      p_source_file_name: file.name,
      p_storage_path: path,
      p_fiscal_period_start: report.fiscalPeriodStart,
      p_fiscal_period_end: report.fiscalPeriodEnd,
      p_report_currency: report.reportCurrency,
      p_lines: lines,
      p_actor_user_id: user.id,
    });
    if (error) {
      if (error.code === "23505") return { ok: false, message: "This exact Apple report was already imported." };
      throw error;
    }
    const value = data as { importId?: unknown; result?: unknown } | null;
    revalidatePath("/admin/revenue");
    return {
      ok: true,
      message: String(value?.result ?? "Apple report validated. Review matched allocations before approval."),
      importId: String(value?.importId ?? ""),
    };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Apple report import failed." };
  }
}

export async function reviewAppleReport(
  _previous: RevenueActionState,
  formData: FormData,
): Promise<RevenueActionState> {
  try {
    const { user } = await requireAdmin();
    const importId = String(formData.get("importId") ?? "");
    const intent = String(formData.get("intent") ?? "");
    if (!uuidPattern.test(importId)) return { ok: false, message: "The financial import identifier is invalid." };
    const admin = createServiceClient();
    if (intent === "approve") {
      const { data, error } = await admin.rpc("approve_apple_financial_import", {
        p_import_id: importId,
        p_actor_user_id: user.id,
      });
      if (error) throw error;
      revalidatePath("/admin/revenue");
      return { ok: true, message: String(data ?? "Final allocations approved."), importId };
    }
    if (intent === "reject") {
      const reason = String(formData.get("reason") ?? "").trim();
      if (reason.length < 3 || reason.length > 300) {
        return { ok: false, message: "Enter a rejection reason from 3 to 300 characters." };
      }
      const { error } = await admin.rpc("reject_apple_financial_import", {
        p_import_id: importId,
        p_reason: reason,
        p_actor_user_id: user.id,
      });
      if (error) throw error;
      revalidatePath("/admin/revenue");
      return { ok: true, message: "The import was rejected and cannot unlock payouts.", importId };
    }
    return { ok: false, message: "Choose approve or reject." };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Apple report review failed." };
  }
}
