"use client";

import { useEffect, useRef } from "react";
import type { Locale } from "@/contracts";
import { syncLocaleCookieAction } from "@/app/(dashboard)/locale-action";

/**
 * A14: rendered by the shell only when the NEXT_LOCALE cookie differs from the signed-in user's
 * saved users.locale. Copies the saved locale into the cookie once; the action refreshes the page.
 */
export function LocaleSync({ locale }: { locale: Locale }) {
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    void syncLocaleCookieAction(locale);
  }, [locale]);
  return null;
}
