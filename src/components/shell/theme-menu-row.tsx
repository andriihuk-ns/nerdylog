"use client";

import { Monitor, Moon, Sun, type LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { MenuSegmentedRow } from "./menu-segmented-row";
import { THEME_ORDER, type ThemePref } from "./theme";
import { useTheme } from "./use-theme";

const THEME_ICON: Record<ThemePref, LucideIcon> = { system: Monitor, light: Sun, dark: Moon };

/** A15 inline "Theme  [Monitor|Sun|Moon]" row in the avatar menu. */
export function ThemeMenuRow() {
  const t = useTranslations("userMenu");
  const { choice, setChoice } = useTheme();
  return (
    <MenuSegmentedRow
      label={t("theme")}
      value={choice}
      onChange={setChoice}
      options={THEME_ORDER.map((pref) => {
        const Icon = THEME_ICON[pref];
        return { value: pref, content: <Icon aria-hidden />, ariaLabel: t(`themes.${pref}`), title: t(`themes.${pref}`) };
      })}
    />
  );
}
