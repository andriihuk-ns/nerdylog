"use client";

import { useEffect, useRef, type KeyboardEvent, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useTranslations } from "next-intl";
import type { IsoDate } from "@/contracts";
import { Button } from "@/components/ui/button";
import { isTypingTarget } from "@/hooks/use-hotkeys";
import { addDays, isIsoDate } from "@/components/lib/dates";
import { useFormat } from "@/hooks/use-format";
import { STANDUPS_TOGGLE_ID } from "./team-header";
import { teamHref, type TeamFilters } from "./team-summary";

interface Props {
  date: IsoDate;
  month: string;
  filters: TeamFilters;
  children: ReactNode;
}

/**
 * docs/05 §6.4 right-side panel (non-modal; the grid reflows beside it on wide screens,
 * full screen under 640px). Focus goes to the title on open; Esc closes and returns focus
 * to the Standups toggle; ↑/↓ move between cards; ←/→ change the date.
 */
export function DrawerShell({ date, month, filters, children }: Props) {
  const router = useRouter();
  const titleRef = useRef<HTMLHeadingElement>(null);
  const t = useTranslations("standups");
  const f = useFormat();
  const hrefFor = (d: IsoDate) => teamHref(month, d, filters);

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  function close() {
    router.push(teamHref(month, null, filters), { scroll: false });
    requestAnimationFrame(() => document.getElementById(STANDUPS_TOGGLE_ID)?.focus());
  }

  function onKeyDown(e: KeyboardEvent<HTMLElement>) {
    if (e.key === "Escape") {
      e.preventDefault();
      close();
      return;
    }
    if (isTypingTarget(e.target)) return;
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      router.push(hrefFor(addDays(date, e.key === "ArrowLeft" ? -1 : 1)), { scroll: false });
    } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      const cards = [...e.currentTarget.querySelectorAll<HTMLElement>("[data-standup-card]")];
      if (cards.length === 0) return;
      e.preventDefault();
      const i = cards.indexOf(document.activeElement as HTMLElement);
      const next = e.key === "ArrowDown" ? Math.min(i + 1, cards.length - 1) : Math.max(i - 1, 0);
      cards[i === -1 ? 0 : next]?.focus();
    }
  }

  return (
    <aside
      id="standup-drawer"
      aria-labelledby="standup-title"
      onKeyDown={onKeyDown}
      className="fixed inset-0 z-40 flex flex-col overflow-y-auto bg-popover shadow-[0_8px_24px_rgb(0_0_0/0.08)] animate-in slide-in-from-right duration-[var(--duration-slow)] ease-spring sm:sticky sm:inset-auto sm:top-20 sm:z-0 sm:max-h-[calc(100vh-6rem)] sm:w-[400px] sm:shrink-0 sm:rounded-lg sm:border dark:shadow-[0_8px_24px_rgb(0_0_0/0.4)]"
    >
      <div className="sticky top-0 z-10 flex flex-col gap-2 border-b bg-popover px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <h2 id="standup-title" ref={titleRef} tabIndex={-1} className="text-lg font-semibold outline-none">
            {t("title")}
          </h2>
          <Button variant="ghost" size="icon" className="hit-target" onClick={close} aria-label={t("close")}>
            <X aria-hidden />
          </Button>
        </div>
        <div className="flex items-center gap-1">
          <Button asChild variant="ghost" size="icon" className="hit-target">
            <Link href={hrefFor(addDays(date, -1))} scroll={false} aria-label={t("previousDay")}>
              <ChevronLeft aria-hidden />
            </Link>
          </Button>
          <label className="sr-only" htmlFor="standup-date">
            {t("date")}
          </label>
          <input
            id="standup-date"
            type="date"
            value={date}
            onChange={(e) => isIsoDate(e.target.value) && router.push(hrefFor(e.target.value), { scroll: false })}
            className="tabular h-11 flex-1 rounded-md border border-input bg-card px-3 hover:border-input-hover focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none"
          />
          <Button asChild variant="ghost" size="icon" className="hit-target">
            <Link href={hrefFor(addDays(date, 1))} scroll={false} aria-label={t("nextDay")}>
              <ChevronRight aria-hidden />
            </Link>
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          {t("caption", { day: f.dayLong(date) })}
        </p>
      </div>
      <div className="flex flex-col gap-6 p-4">{children}</div>
    </aside>
  );
}
