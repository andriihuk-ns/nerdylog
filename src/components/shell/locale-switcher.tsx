"use client";

import { useTranslations } from "next-intl";
import type { Locale } from "@/contracts";
import { useLocaleSwitch } from "@/hooks/use-locale-switch";
import { SegmentedControl } from "./segmented-control";

/** Display order of the segmented control: "EN | УКР". */
export const SWITCHER_LOCALES: readonly Locale[] = ["en", "uk"];

/** A14 compact language switcher (login page): "EN | УКР" segmented control; choosing saves at once. */
export function LocaleSwitcher({ className }: { className?: string }) {
  const t = useTranslations("locale");
  const { locale, pending, choose } = useLocaleSwitch();
  return (
    <SegmentedControl
      label={t("label")}
      value={locale}
      busy={pending}
      onChange={choose}
      className={className}
      options={SWITCHER_LOCALES.map((l) => ({ value: l, content: t(`short.${l}`), ariaLabel: t(`name.${l}`), lang: l }))}
    />
  );
}
