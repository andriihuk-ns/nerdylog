/** Number formatting per docs/05 §3: hours 1 decimal, days up to 2, counts integer or .5, % integer. */

const ZERO = "·";

/** 2.5 → "2.5", 8 → "8.0". */
export function formatHours(hours: number): string {
  return (Math.round(hours * 100) / 100).toFixed(1);
}

/** 19 → "19.0", 7.25 → "7.25", 7.5 → "7.5", 0.333 → "0.33". */
export function formatDays(days: number): string {
  const fixed = (Math.round(days * 100) / 100).toFixed(2);
  return fixed.endsWith("0") ? fixed.slice(0, -1) : fixed;
}

/** 2 → "2", 0.5 → "0.5". */
export function formatCount(count: number): string {
  const rounded = Math.round(count * 2) / 2;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
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

export type HoursParse = { ok: true; value: number } | { ok: false; message: string };

/**
 * Cell input → hours. Accepts "." or "," as decimal, snaps to 0.25 h, rejects > 24 and
 * negatives. Empty input means 0 (clear the cell).
 */
export function parseHoursInput(raw: string): HoursParse {
  const text = raw.trim().replace(",", ".");
  if (text === "") return { ok: true, value: 0 };
  if (!/^\d*\.?\d*$/.test(text) || text === ".") return { ok: false, message: "Enter a number of hours" };
  const value = Math.round(Number(text) * 4) / 4;
  if (value > 24) return { ok: false, message: "Max 24h a day" };
  return { ok: true, value };
}
