import { z } from "zod";

/** A14: supported UI / bot languages. First visit and unknown users default to Ukrainian. */
export const LOCALES = ["uk", "en"] as const;
export const localeSchema = z.enum(LOCALES);
export type Locale = z.infer<typeof localeSchema>;
export const DEFAULT_LOCALE: Locale = "uk";
export const LOCALE_COOKIE = "NEXT_LOCALE";

export function toLocale(value: unknown): Locale {
  return localeSchema.safeParse(value).success ? (value as Locale) : DEFAULT_LOCALE;
}
