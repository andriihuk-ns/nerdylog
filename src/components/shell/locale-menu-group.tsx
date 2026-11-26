"use client";

import { useId } from "react";
import { useTranslations } from "next-intl";
import { toLocale } from "@/contracts";
import { DropdownMenuGroup, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem } from "@/components/ui/dropdown-menu";
import { useLocaleSwitch } from "@/hooks/use-locale-switch";
import { SWITCHER_LOCALES } from "./locale-switcher";

/** A14 "Language" group in the avatar menu, same pattern as the Theme group. Saves users.locale too. */
export function LocaleMenuGroup() {
  const t = useTranslations("locale");
  const labelId = useId();
  const { locale, choose } = useLocaleSwitch();
  return (
    <DropdownMenuGroup>
      <DropdownMenuLabel id={labelId} className="text-xs font-medium text-muted-foreground">
        {t("label")}
      </DropdownMenuLabel>
      <DropdownMenuRadioGroup aria-labelledby={labelId} value={locale} onValueChange={(v) => choose(toLocale(v))}>
        {SWITCHER_LOCALES.map((l) => (
          <DropdownMenuRadioItem key={l} value={l} lang={l} className="min-h-11">
            {t(`name.${l}`)}
            <span className="ml-auto text-xs text-muted-foreground">{t(`short.${l}`)}</span>
          </DropdownMenuRadioItem>
        ))}
      </DropdownMenuRadioGroup>
    </DropdownMenuGroup>
  );
}
