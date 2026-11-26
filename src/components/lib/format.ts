/**
 * Number formatting per docs/05 §3: hours 1 decimal, days up to 2, counts integer or .5, % integer.
 * A14: the decimal separator follows the active locale ("2.5" en, "2,5" uk). Grouping is off so
 * a formatted value can be typed back into an input and parsed again.
 */

const ZERO = "·";

const numberFormats = new Map<string, Intl.NumberFormat>();

function decimal(locale: string, min: number, max: number): Intl.NumberFormat {
  const key = `${locale}:${min}:${max}`;
  let nf = numberFormats.get(key);
  if (!nf) {
    nf = new Intl.NumberFormat(locale, { minimumFractionDigits: min, maximumFractionDigits: max, useGrouping: false });
    numberFormats.set(key, nf);
  }
  return nf;
}

/** 2.5 → "2.5" ("2,5" in uk), 8 → "8.0". */
export function formatHours(hours: number, locale = "en"): string {
  return decimal(locale, 1, 1).format(Math.round(hours * 100) / 100);
}

/** 19 → "19.0", 7.25 → "7.25", 7.5 → "7.5", 0.333 → "0.33". */
export function formatDays(days: number, locale = "en"): string {
  return decimal(locale, 1, 2).format(Math.round(days * 100) / 100);
}

/** 2 → "2", 0.5 → "0.5". */
export function formatCount(count: number, locale = "en"): string {
  return decimal(locale, 0, 1).format(Math.round(count * 2) / 2);
}

export function formatPercent(ratio: number): string {
  return `${Math.round(ratio * 100)}%`;
}

/** Summary-matrix cell: zero shows as a muted middle dot to cut noise. */
export function orDot(value: number, format: (n: number) => string): string {
  return value === 0 ? ZERO : format(value);
}

/** "Jane Doe" → "JD"; "" → "?". */
export function initials(name: string): string {
  const letters = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "");
  return letters.join("") || "?";
}

/** "2,5" / "2.5" / " 2 5 " → "2.5": comma is a decimal separator (A14), spaces are dropped. */
export function normalizeDecimal(raw: string): string {
  return raw.replace(/[\s\u00a0\u202f]/g, "").replace(",", ".");
}

/** Error codes, not copy: the UI maps them to `myTime.input.*` messages. */
export type HoursParseError = "invalid" | "max";
export type HoursParse = { ok: true; value: number } | { ok: false; error: HoursParseError };

/**
 * Cell input → hours. Accepts "." or "," as decimal, snaps to 0.25 h, rejects > 24 and
 * negatives. Empty input means 0 (clear the cell).
 */
export function parseHoursInput(raw: string): HoursParse {
  const text = normalizeDecimal(raw);
  if (text === "") return { ok: true, value: 0 };
  if (!/^\d*\.?\d*$/.test(text) || text === ".") return { ok: false, error: "invalid" };
  const value = Math.round(Number(text) * 4) / 4;
  if (value > 24) return { ok: false, error: "max" };
  return { ok: true, value };
}
