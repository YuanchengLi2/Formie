import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { parseAppleFinancialReport } from "./apple-financials";

const columns = ["Start Date", "End Date", "Transaction Date", "Settlement Date", "Vendor Identifier", "Product Type Identifier", "Country of Sale", "Quantity", "Sale or Return", "Partner Share", "Extended Partner Share", "Partner Share Currency", "Customer Price", "Customer Currency"];
const sale = ["08/03/2026", "08/30/2026", "08/04/2026", "09/04/2026", "formie_monthly", "1A", "US", "1", "S", "6.99", "6.99", "USD", "9.99", "USD"];
const report = (rows: string[][] = [sale], headers = columns) => [headers.join("\t"), ...rows.map((row) => row.join("\t"))].join("\n");

test("parses Apple's Vendor Identifier layout and preserves reconciliation fields", () => {
  const parsed = parseAppleFinancialReport(report());
  assert.equal(parsed.fiscalPeriodStart, "2026-08-03");
  assert.equal(parsed.fiscalPeriodEnd, "2026-08-30");
  assert.equal(parsed.reportCurrency, "USD");
  assert.deepEqual(parsed.lines[0], { lineNumber: 2, transactionDate: "2026-08-04", settlementDate: "2026-09-04", sku: "formie_monthly", productTypeIdentifier: "1A", countryOfSale: "US", quantity: 1, saleOrReturn: "S", partnerShare: 6.99, extendedPartnerShare: 6.99, partnerShareCurrency: "USD", customerPrice: 9.99, customerCurrency: "USD" });
});

test("accepts the supported SKU header alias", () => {
  const headers = [...columns]; headers[4] = "SKU";
  assert.equal(parseAppleFinancialReport(report([sale], headers)).lines[0].sku, "formie_monthly");
});

test("identical reports produce the same immutable import fingerprint", () => {
  const bytes = Buffer.from(report());
  const first = createHash("sha256").update(bytes).digest("hex");
  const second = createHash("sha256").update(bytes).digest("hex");
  assert.equal(first, second);
  assert.match(first, /^[0-9a-f]{64}$/);
});

test("rejects missing columns, malformed rows, invalid dates, and unsupported SKUs", () => {
  assert.throws(() => parseAppleFinancialReport(report([sale], columns.slice(0, -1))), /column count|Missing Apple report column/);
  const short = sale.slice(0, -1);
  assert.throws(() => parseAppleFinancialReport(report([short])), /column count/);
  const badDate = [...sale]; badDate[0] = "August";
  assert.throws(() => parseAppleFinancialReport(report([badDate])), /fiscal period/);
  const wrongSku = [...sale]; wrongSku[4] = "another_app";
  assert.throws(() => parseAppleFinancialReport(report([wrongSku])), /Unexpected SKU/);
});

test("rejects incompatible quantities and allocation totals before import", () => {
  const fractional = [...sale]; fractional[7] = "1.5";
  assert.throws(() => parseAppleFinancialReport(report([fractional])), /quantity/);
  const inconsistent = [...sale]; inconsistent[10] = "6.50";
  assert.throws(() => parseAppleFinancialReport(report([inconsistent])), /proceeds do not match quantity/);
});

test("preserves missing FX compatibility for reconciliation instead of converting it", () => {
  const noFx = [...sale]; noFx[13] = "EUR";
  const parsed = parseAppleFinancialReport(report([noFx]));
  assert.equal(parsed.lines[0].customerCurrency, "EUR");
  assert.equal(parsed.lines[0].partnerShareCurrency, "USD");
});

test("requires one fiscal period and one partner currency per immutable import", () => {
  const later = [...sale]; later[0] = "08/31/2026"; later[1] = "09/27/2026";
  assert.throws(() => parseAppleFinancialReport(report([sale, later])), /one Apple fiscal period/);
  const euro = [...sale]; euro[11] = "EUR"; euro[13] = "EUR";
  assert.throws(() => parseAppleFinancialReport(report([sale, euro])), /one Apple report currency/);
});
