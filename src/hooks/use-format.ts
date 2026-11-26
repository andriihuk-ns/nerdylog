import { useLocale } from "next-intl";
import { localeFormat, type LocaleFormat } from "@/components/lib/locale-format";

/**
 * Locale-bound number/date formatters for client and non-async server components.
 * Async server components use `localeFormat(await getLocale())` instead.
 */
export function useFormat(): LocaleFormat {
  return localeFormat(useLocale());
}
