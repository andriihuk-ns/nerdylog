import type { IsoDate } from "@/contracts";
import { firstDayOfMonth, lastDayOfMonth } from "@/components/lib/dates";
import type { ExportGroups } from "./export-menu";

export function exportHref(path: string, params: Record<string, string>): string {
  return `${path}?${new URLSearchParams(params).toString()}`;
}

/** A15 Week ▾ / Month ▾ links: ledger CSV + report PDF for a date range (optionally one user). */
export function rangeExports(week: { from: IsoDate; to: IsoDate }, month: string, extra: Record<string, string> = {}): ExportGroups {
  const monthRange = { from: firstDayOfMonth(month), to: lastDayOfMonth(month) };
  const pair = (range: { from: IsoDate; to: IsoDate }) => [
    { kind: "csv" as const, href: exportHref("/api/export/ledger.csv", { ...range, ...extra }) },
    { kind: "pdf" as const, href: exportHref("/api/export/report.pdf", { ...range, ...extra }) },
  ];
  return { week: pair(week), month: pair(monthRange), customRange: { ...week, extra } };
}
