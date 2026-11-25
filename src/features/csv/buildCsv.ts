import { CSV_COLUMNS_NO_DESCRIPTION } from "@/lib/constants";
import { getMarketplace } from "@/features/ai/marketplaces";
import { formatKeywords } from "@/features/metadata/normalizer";
import type { BatchItem } from "@/types/batch";
import type { CsvColumnId } from "@/types/metadata";

/** Quote a CSV field. Also blocks spreadsheet formula injection (=, +, -, @ at the start). */
function field(value: string): string {
  let v = value;
  if (/^[=+\-@\t\r]/.test(v)) v = `'${v}`;
  return /[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

const HEADER: Record<CsvColumnId, string> = {
  filename: "Filename",
  title: "Title",
  description: "Description",
  keywords: "Keywords",
  categories: "Categories",
};

/**
 * One CSV layout per marketplace (its rules say which columns, in which order):
 *   Adobe Stock : Filename, Title, Description, Keywords
 *   Shutterstock: Filename, Description, Keywords, Categories
 * When Description is optional and switched off (no file has one) its column is left out.
 * Only successful files are included.
 */
export function buildCsv(items: readonly BatchItem[], marketplaceId?: string | null): string {
  const rules = getMarketplace(marketplaceId).rules;
  const done = items.filter((i) => i.status === "success" && i.meta);
  const withDescription =
    rules.descriptionRequired || done.length === 0 || done.some((i) => Boolean(i.meta?.description));
  const columns = rules.csvColumns.filter((c) => c !== "description" || withDescription);

  const rows: string[] = [columns.map((c) => HEADER[c]).join(",")];
  for (const item of done) {
    const meta = item.meta!;
    const value: Record<CsvColumnId, string> = {
      filename: item.fileName,
      title: meta.title,
      description: meta.description,
      keywords: formatKeywords(meta.keywords),
      categories: (meta.categories ?? []).join(","),
    };
    rows.push(columns.map((c) => field(value[c])).join(","));
  }
  return rows.join("\r\n") + "\r\n";
}

/** Kept for callers that only need the Adobe-style header without a description. */
export { CSV_COLUMNS_NO_DESCRIPTION };

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * tj-meta-shutterstock-2026-10-06_06-25-30PM.csv
 * (marketplace id, then the viewer's local time on a 12-hour clock; id left out when unknown)
 */
export function csvFileName(isoDate: string, marketplaceId?: string | null): string {
  const d = new Date(isoDate);
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const h = d.getHours();
  const time = `${pad(h % 12 || 12)}-${pad(d.getMinutes())}-${pad(d.getSeconds())}${h < 12 ? "AM" : "PM"}`;
  const market = marketplaceId ? `${marketplaceId}-` : "";
  return `tj-meta-${market}${date}_${time}.csv`;
}
