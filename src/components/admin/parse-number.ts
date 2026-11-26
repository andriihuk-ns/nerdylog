import { normalizeDecimal } from "@/components/lib/format";

/** Parses and validates a decimal; null when empty and allowed; undefined when invalid. */
export function parseBoundedNumber(
  raw: string,
  min: number,
  max: number,
  step: number,
  allowEmpty: boolean,
): number | null | undefined {
  const text = normalizeDecimal(raw);
  if (text === "") return allowEmpty ? null : undefined;
  const n = Number(text);
  if (!Number.isFinite(n) || n < min || n > max) return undefined;
  const snapped = Math.round(n / step) * step;
  return Math.round(snapped * 100) / 100;
}
