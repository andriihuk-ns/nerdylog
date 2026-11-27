"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { IsoDate } from "@/contracts";
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
  exportScopeHint?: string;
  projects: FilterOption[];
  exports: ExportGroups;
}

export const STANDUPS_TOGGLE_ID = "standups-toggle";

/** `‹ November 2026 ›`, Export week ▾ / Export month ▾, search + project filter. Keys: `[` / `]` month. */
export function TeamHeader({ month, today, drawerDate, filters, exportScopeHint, projects, exports }: Props) {
  const router = useRouter();
  const tm = useTranslations("metadata");
  const tp = useTranslations("period");
  const f = useFormat();
  const prev = teamHref(shiftMonth(month, -1), drawerDate, filters);
  const next = teamHref(shiftMonth(month, 1), drawerDate, filters);
  const current = today.slice(0, 7);

  useHotkeys({
    "[": () => router.push(prev, { scroll: false }),
    "]": () => router.push(next, { scroll: false }),
  });

  return (
    <div className="flex flex-col gap-4">
      <h1 className="sr-only">{tm("team")}</h1>
      <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center">
        <PeriodSwitcher
          unit="month"
          label={f.month(month)}
          prevHref={prev}
          nextHref={next}
          todayHref={month === current ? undefined : teamHref(current, drawerDate, filters)}
          todayLabel={tp("thisMonth")}
          action="/team"
          pickerValue={month}
          preserveParams={{
            ...(filters.q ? { q: filters.q } : {}),
            ...(filters.project ? { project: filters.project } : {}),
          }}
        />
        <TeamFilterBar month={month} drawerDate={drawerDate} filters={filters} projects={projects} className="min-w-0 flex-1" />
        <div className="grid grid-cols-1 gap-2 md:ml-auto md:flex md:flex-wrap md:items-center">
          <ExportMenus groups={exports} />
        </div>
      </div>
      {exportScopeHint ? <p className="text-xs text-muted-foreground">{exportScopeHint}</p> : null}
    </div>
  );
}
