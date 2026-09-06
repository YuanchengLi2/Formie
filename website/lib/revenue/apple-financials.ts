export type AppleFinancialLine = { lineNumber: number; transactionDate: string | null; settlementDate: string | null; sku: string; productTypeIdentifier: string | null; countryOfSale: string | null; quantity: number; saleOrReturn: "S" | "R"; partnerShare: number; extendedPartnerShare: number; partnerShareCurrency: string; customerPrice: number | null; customerCurrency: string | null };
export type AppleFinancialReport = { fiscalPeriodStart: string; fiscalPeriodEnd: string; reportCurrency: string; lines: AppleFinancialLine[] };

const aliases = { startDate: ["Start Date"], endDate: ["End Date"], transactionDate: ["Transaction Date"], settlementDate: ["Settlement Date"], sku: ["Vendor Identifier", "SKU"], productType: ["Product Type Identifier"], country: ["Country of Sale"], quantity: ["Quantity"], saleReturn: ["Sale or Return"], partnerShare: ["Partner Share"], extended: ["Extended Partner Share"], partnerCurrency: ["Partner Share Currency"], customerPrice: ["Customer Price"], customerCurrency: ["Customer Currency"] } as const;

function parseDate(value: string): string | null {
  if (!value.trim()) return null;
  const normalized = value.trim();
  const parsed = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(normalized);
  if (parsed) return parsed[3] + "-" + parsed[1] + "-" + parsed[2];
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : null;
}

export function parseAppleFinancialReport(text: string): AppleFinancialReport {
  const rows = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim()).map((line) => line.split("\t"));
  if (rows.length < 2) throw new Error("The Apple report has no data rows.");
  if (rows.length > 50_001) throw new Error("The Apple report exceeds the 50,000-row import limit.");
  const headers = rows[0].map((value) => value.trim());
  const find = (names: readonly string[]) => {
    const index = headers.findIndex((header) => names.includes(header));
    if (index < 0) throw new Error("Missing Apple report column: " + names[0]);
    return index;
  };
  const index = Object.fromEntries(Object.entries(aliases).map(([key, names]) => [key, find(names)])) as Record<keyof typeof aliases, number>;
  const allowedSkus = new Set((process.env.APPLE_FORMIE_SKUS ?? "formie_monthly").split(",").map((value) => value.trim()).filter(Boolean));
  const periods = new Set<string>();
  const lines = rows.slice(1).map((row, offset) => {
    const lineNumber = offset + 2;
    if (row.length !== headers.length) throw new Error("Unexpected column count on Apple report line " + lineNumber);
    const number = (key: keyof typeof aliases) => {
      const value = Number(row[index[key]]);
      if (!Number.isFinite(value)) throw new Error("Invalid number on Apple report line " + lineNumber);
      return value;
    };
    const start = parseDate(row[index.startDate] ?? "");
    const end = parseDate(row[index.endDate] ?? "");
    if (!start || !end || end < start) throw new Error("Invalid fiscal period on Apple report line " + lineNumber);
    periods.add(start + "|" + end);
    const transactionRaw = row[index.transactionDate] ?? "";
    const settlementRaw = row[index.settlementDate] ?? "";
    const transactionDate = parseDate(transactionRaw);
    const settlementDate = parseDate(settlementRaw);
    if ((transactionRaw.trim() && !transactionDate) || (settlementRaw.trim() && !settlementDate)) throw new Error("Invalid transaction date on Apple report line " + lineNumber);
    const sku = (row[index.sku] ?? "").trim();
    if (!allowedSkus.has(sku)) throw new Error("Unexpected SKU on Apple report line " + lineNumber);
    const saleOrReturn = (row[index.saleReturn] ?? "").trim() as "S" | "R";
    if (saleOrReturn !== "S" && saleOrReturn !== "R") throw new Error("Invalid sale/return value on Apple report line " + lineNumber);
    const partnerShareCurrency = (row[index.partnerCurrency] ?? "").trim().toUpperCase();
    const customerCurrency = (row[index.customerCurrency] ?? "").trim().toUpperCase() || null;
    if (!/^[A-Z]{3}$/.test(partnerShareCurrency) || (customerCurrency && !/^[A-Z]{3}$/.test(customerCurrency))) throw new Error("Invalid currency on Apple report line " + lineNumber);
    const quantity = number("quantity");
    const partnerShare = number("partnerShare");
    const extendedPartnerShare = number("extended");
    if (!Number.isInteger(quantity) || quantity === 0) throw new Error("Invalid quantity on Apple report line " + lineNumber);
    if (Math.abs(extendedPartnerShare - partnerShare * quantity) > 0.011) throw new Error("Partner proceeds do not match quantity on Apple report line " + lineNumber);
    return { lineNumber, transactionDate, settlementDate, sku, productTypeIdentifier: (row[index.productType] ?? "").trim() || null, countryOfSale: (row[index.country] ?? "").trim().toUpperCase() || null, quantity, saleOrReturn, partnerShare, extendedPartnerShare, partnerShareCurrency, customerPrice: (row[index.customerPrice] ?? "").trim() ? number("customerPrice") : null, customerCurrency } satisfies AppleFinancialLine;
  });
  if (periods.size !== 1) throw new Error("Upload exactly one Apple fiscal period at a time.");
  const [fiscalPeriodStart, fiscalPeriodEnd] = [...periods][0].split("|");
  const currencies = [...new Set(lines.map((line) => line.partnerShareCurrency))];
  if (currencies.length !== 1) throw new Error("Upload one Apple report currency at a time.");
  return { fiscalPeriodStart, fiscalPeriodEnd, reportCurrency: currencies[0], lines };
}
