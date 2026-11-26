import type { Locale } from "@/contracts";
import type messages from "../../messages/en.json";

/**
 * A14: typed next-intl. `t("…")` keys are checked against messages/en.json (uk.json parity is a
 * unit test), and useLocale()/getLocale() return the contract's Locale ("en" | "uk").
 */
declare module "next-intl" {
  interface AppConfig {
    Locale: Locale;
    Messages: typeof messages;
  }
}
