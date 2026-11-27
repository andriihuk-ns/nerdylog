"use client";

import { useTranslations } from "next-intl";
import { useLocaleSwitch } from "@/hooks/use-locale-switch";
import { SWITCHER_LOCALES } from "./locale-switcher";
import { MenuSegmentedRow } from "./menu-segmented-row";

/** A14/A15 inline "Language  EN | УКР" row in the avatar menu. Saves users.locale too. */
export function LocaleMenuRow() {
  const t = useTranslations("locale");
  const { locale, choose } = useLocaleSwitch();
  return (
    <MenuSegmentedRow
      label={t("label")}
      value={locale}
      onChange={choose}
      options={SWITCHER_LOCALES.map((l) => ({
        value: l,
        content: t(`short.${l}`),
        ariaLabel: t(`name.${l}`),
        title: t(`name.${l}`),
        lang: l,
      }))}
    />
  );
}
