/**
 * Pure CSV encoding (RFC 4180): CRLF line ends, fields with `"` `,` CR or LF are quoted,
 * quotes doubled. Output is UTF-8 with a BOM so Excel and Google Sheets detect the encoding.
 */

export const UTF8_BOM = "﻿";
export const CSV_CONTENT_TYPE = "text/csv; charset=utf-8";

/** Text cells starting with these could run as spreadsheet formulas (CSV injection). */
const FORMULA_PREFIX = /^[=+\-@\t\r]/;

export type CsvCell = string | number;

export function csvCell(value: CsvCell): string {
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * For free-text cells only (names, task notes): prefix a `'` when the text would start a
 * formula, the OWASP mitigation. Numeric cells never go through this.
 */
export function safeText(value: string): string {
  return FORMULA_PREFIX.test(value) ? `'${value}` : value;
}

export function toCsv(rows: ReadonlyArray<readonly CsvCell[]>): string {
  return rows.map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

/** UTF-8 bytes with BOM. */
export function encodeCsv(rows: ReadonlyArray<readonly CsvCell[]>): Uint8Array {
  return new TextEncoder().encode(UTF8_BOM + toCsv(rows));
}

/** Locale-free number: rounded to `maxDecimals`, no trailing zeros, "." decimal point. */
export function formatNumber(value: number, maxDecimals: number): string {
  const factor = 10 ** maxDecimals;
  const rounded = Math.round(value * factor) / factor;
  return Object.is(rounded, -0) ? "0" : String(rounded);
}
