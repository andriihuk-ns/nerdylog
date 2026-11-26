"use client";

import { useOptimistic, useTransition } from "react";
import { useLocale } from "next-intl";
import type { Locale } from "@/contracts";
import { setLocaleAction } from "@/app/(dashboard)/locale-action";

/** A14: current locale (optimistic while saving) + a setter that saves and refreshes the route. */
export function useLocaleSwitch(): { locale: Locale; pending: boolean; choose: (next: Locale) => void } {
  const current = useLocale();
  const [locale, setOptimistic] = useOptimistic(current);
  const [pending, startTransition] = useTransition();

  function choose(next: Locale) {
    if (next === locale) return;
    startTransition(async () => {
      setOptimistic(next);
      await setLocaleAction(next);
    });
  }

  return { locale, pending, choose };
}
