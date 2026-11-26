import { DEFAULT_LOCALE, toLocale, type Locale } from "@/contracts";
import { en, type MessageKey, type Messages } from "./en";
import { uk } from "./uk";

/**
 * A14: tiny typed dictionary for the Slack bot (personal surfaces only). Not next-intl:
 * the bot renders Block Kit on the server for a recipient whose locale we already know.
 */
export const DICTIONARIES: Record<Locale, Messages> = { en, uk };

export type { Locale, MessageKey, Messages };

export type MessageVars = Record<string, string | number>;

/** Translate `key` for `locale`, filling `{name}` placeholders. Unknown placeholders stay as-is. */
export function t(locale: Locale, key: MessageKey, vars?: MessageVars): string {
  const template = DICTIONARIES[locale]?.[key] ?? en[key];
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => (name in vars ? String(vars[name]) : match));
}

type BaseOf<K> = K extends `plural.${infer Rest}.other` ? `plural.${Rest}` : never;
/** "plural.days" etc.: every `plural.*` group that defines an `.other` form. */
export type PluralBase = BaseOf<MessageKey>;

/** Plural form via Intl.PluralRules (uk: one/few/many/other). `{n}` is filled with `formatted ?? n`. */
export function tPlural(locale: Locale, base: PluralBase, n: number, formatted?: string): string {
  const rule = new Intl.PluralRules(intlTag(locale)).select(n);
  const form = rule === "one" || rule === "few" || rule === "many" ? rule : "other";
  return t(locale, `${base}.${form}` as MessageKey, { n: formatted ?? n });
}

/** BCP 47 tag for Intl formatting in the bot. */
export function intlTag(locale: Locale): string {
  return locale === "uk" ? "uk-UA" : "en-GB";
}

/** The recipient's locale; missing or unknown values (unknown Slack users) fall back to Ukrainian. */
export function localeOf(profile: { locale?: unknown } | null | undefined): Locale {
  return profile ? toLocale(profile.locale) : DEFAULT_LOCALE;
}
