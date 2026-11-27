"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { MessageSquareText } from "lucide-react";
import { useTranslations } from "next-intl";
import type { IsoDate } from "@/contracts";
import { Button } from "@/components/ui/button";
import { useHotkeys } from "@/hooks/use-hotkeys";
import { PeriodSwitcher } from "@/components/shell/period-switcher";
import { ExportMenus, type ExportGroups } from "@/components/shell/export-menu";
import type { FilterOption } from "@/components/shell/filter-select";
import { shiftMonth } from "@/components/lib/dates";
import { useFormat } from "@/hooks/use-format";
import { teamHref, type TeamFilters } from "./team-summary";
import { TeamFilterBar } from "./team-filter-bar";

interface Props {
  month: string;
  today: IsoDate;
  drawerDate: IsoDate | null;
  filters: TeamFilters;
  projects: FilterOption[];
  exports: ExportGroups;
}

export const STANDUPS_TOGGLE_ID = "standups-toggle";

/** `‹ November 2026 ›`, Export week ▾ / Export month ▾, Status toggle, search + project filter. Keys: `[` / `]` month, `S` drawer. */
export function TeamHeader({ month, today, drawerDate, filters, projects, exports }: Props) {
  const router = useRouter();
  const t = useTranslations("team");
  const tm = useTranslations("metadata");
  const tp = useTranslations("period");
  const f = useFormat();
  const prev = teamHref(shiftMonth(month, -1), drawerDate, filters);
  const next = teamHref(shiftMonth(month, 1), drawerDate, filters);
  const current = today.slice(0, 7);
  const toggleHref = teamHref(month, drawerDate ? null : today, filters);

  useHotkeys({
    "[": () => router.push(prev),
    "]": () => router.push(next),
    s: () => router.push(toggleHref),
  });

  return (
    <div className="flex flex-col gap-4">
      <h1 className="sr-only">{tm("team")}</h1>
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <PeriodSwitcher
          unit="month"
          label={f.month(month)}
          prevHref={prev}
          nextHref={next}
          todayHref={month === current ? undefined : teamHref(current, drawerDate, filters)}
          todayLabel={tp("thisMonth")}
        />
        <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:items-center">
          <ExportMenus groups={exports} />
          <Button asChild variant={drawerDate ? "secondary" : "outline"} className="hit-target w-full sm:w-auto">
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
      <TeamFilterBar month={month} drawerDate={drawerDate} filters={filters} projects={projects} />
    </div>
  );
}
