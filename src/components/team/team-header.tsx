"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { MessageSquareText } from "lucide-react";
import { useTranslations } from "next-intl";
import type { IsoDate } from "@/contracts";
import { Button } from "@/components/ui/button";
import { useHotkeys } from "@/hooks/use-hotkeys";
import { PeriodSwitcher } from "@/components/shell/period-switcher";
import { ExportLinks, type ExportLink } from "@/components/shell/export-links";
import { shiftMonth } from "@/components/lib/dates";
import { useFormat } from "@/hooks/use-format";
import { teamHref } from "./team-summary";

interface Props {
  month: string;
  today: IsoDate;
  drawerDate: IsoDate | null;
  exports: ExportLink[];
}

export const STANDUPS_TOGGLE_ID = "standups-toggle";

/** `‹ November 2026 ›`, exports, Standups toggle. Keys: `[` / `]` month, `S` drawer. */
export function TeamHeader({ month, today, drawerDate, exports }: Props) {
  const router = useRouter();
  const t = useTranslations("team");
  const tp = useTranslations("period");
  const f = useFormat();
  const prev = teamHref(shiftMonth(month, -1), drawerDate);
  const next = teamHref(shiftMonth(month, 1), drawerDate);
  const current = today.slice(0, 7);
  const toggleHref = teamHref(month, drawerDate ? null : today);

  useHotkeys({
    "[": () => router.push(prev),
    "]": () => router.push(next),
    s: () => router.push(toggleHref),
  });

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold tracking-[-0.01em]">{t("title")}</h1>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <PeriodSwitcher
          unit="month"
          label={f.month(month)}
          prevHref={prev}
          nextHref={next}
          todayHref={month === current ? undefined : teamHref(current, drawerDate)}
          todayLabel={tp("thisMonth")}
        />
        <div className="flex flex-wrap items-center gap-2">
          <ExportLinks links={exports} />
          <Button
            asChild
            variant={drawerDate ? "secondary" : "outline"}
            className="hit-target"
          >
            <Link
              id={STANDUPS_TOGGLE_ID}
              href={toggleHref}
              aria-expanded={drawerDate !== null}
              aria-controls="standup-drawer"
              aria-keyshortcuts="S"
              scroll={false}
            >
              <MessageSquareText aria-hidden />
              {t("standupsToggle")}
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
