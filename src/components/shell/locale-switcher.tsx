"use client";

import { useRef, type KeyboardEvent } from "react";
import { useTranslations } from "next-intl";
import type { Locale } from "@/contracts";
import { cn } from "@/lib/utils";
import { useLocaleSwitch } from "@/hooks/use-locale-switch";

/** Display order of the segmented control: "EN | УКР". */
export const SWITCHER_LOCALES: readonly Locale[] = ["en", "uk"];

/**
 * A14 compact language switcher: a two-segment radio group in the segmented-tabs style
 * (muted track, raised pill). Arrow keys move between options; choosing saves at once.
 */
export function LocaleSwitcher({ className }: { className?: string }) {
  const t = useTranslations("locale");
  const { locale, pending, choose } = useLocaleSwitch();
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) return;
    e.preventDefault();
    const i = SWITCHER_LOCALES.indexOf(locale);
    const delta = e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 1;
    const next = SWITCHER_LOCALES[(i + delta + SWITCHER_LOCALES.length) % SWITCHER_LOCALES.length];
    choose(next);
    refs.current[next]?.focus();
  }

  return (
    <div
      role="radiogroup"
      aria-label={t("label")}
      aria-busy={pending || undefined}
      onKeyDown={onKeyDown}
      className={cn("inline-flex h-8 items-center gap-0.5 rounded-lg bg-muted p-[3px] text-muted-foreground", className)}
    >
      {SWITCHER_LOCALES.map((l) => {
        const checked = l === locale;
        return (
          <button
            key={l}
            ref={(el) => {
              refs.current[l] = el;
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            aria-label={t(`name.${l}`)}
            lang={l}
            tabIndex={checked ? 0 : -1}
            onClick={() => choose(l)}
            className={cn(
              "relative inline-flex h-full min-w-11 items-center justify-center rounded-md px-2.5 text-xs font-medium select-none",
              "transition-[color,background-color,box-shadow] duration-(--duration-base) ease-spring hover:text-foreground",
              "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
              // 44px hit target without growing the 26px visual segment.
              "before:absolute before:inset-x-0 before:-inset-y-[9px] before:content-['']",
              checked &&
                "bg-card text-foreground shadow-[0_1px_2px_0_rgb(0_0_0/0.06),0_0_0_1px_rgb(0_0_0/0.06)] dark:bg-foreground/10 dark:shadow-[0_1px_2px_0_rgb(0_0_0/0.4),inset_0_0_0_1px_rgb(255_255_255/0.06)]",
            )}
          >
            {t(`short.${l}`)}
          </button>
        );
      })}
    </div>
  );
}
