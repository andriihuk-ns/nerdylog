import type { Metadata } from "next";
import type { ProjectView } from "@/contracts";
import { requireActor } from "@/server/auth/session";
import { listWeekEntries } from "@/server/services/time-entry-service";
import { listProjects } from "@/server/services/project-service";
import { getProjectCapUsage } from "@/server/services/rollup-service";
import { getPtoBalance } from "@/server/services/pto-service";
import { addDays, firstDayOfMonth, lastDayOfMonth, monthForWeek, parseWeekParam, todayIn } from "@/components/lib/dates";
import { WeekView } from "@/components/my-time/week-view";
import { CapPills } from "@/components/my-time/cap-pills";
import { PtoBalanceCard } from "@/components/my-time/pto-balance-card";
import { ExportLinks, exportHref } from "@/components/shell/export-links";

export const metadata: Metadata = { title: "My time" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function MyTimePage({ searchParams }: { searchParams: SearchParams }) {
  const actor = await requireActor();
  const params = await searchParams;
  // Assumption: Actor has no timezone yet, so "today" uses the company default (Europe/Kyiv).
  const today = todayIn();
  const weekStart = parseWeekParam(params.week, today);
  const weekEnd = addDays(weekStart, 6);
  const month = monthForWeek(weekStart, today);

  const [entries, projects, caps, pto] = await Promise.all([
    listWeekEntries(actor, actor.userId, weekStart),
    listProjects(actor),
    getProjectCapUsage(actor, month),
    getPtoBalance(actor, actor.userId, Number(today.slice(0, 4))),
  ]);
  const activeProjects = projects.filter((p: ProjectView) => p.isActive).map((p: ProjectView) => ({ id: p.id, name: p.name }));
  const week = { from: weekStart, to: weekEnd };
  const monthRange = { from: firstDayOfMonth(month), to: lastDayOfMonth(month) };

  return (
    <div className="flex flex-col gap-8">
      <WeekView key={weekStart} weekStart={weekStart} today={today} entries={entries} activeProjects={activeProjects} />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <CapPills caps={caps} month={month} />
        <PtoBalanceCard balance={pto} />
      </div>
      <ExportLinks
        links={[
          { label: "Week CSV", href: exportHref("/api/export/ledger.csv", week) },
          { label: "Week PDF", href: exportHref("/api/export/report.pdf", week) },
          { label: "Month CSV", href: exportHref("/api/export/ledger.csv", monthRange) },
          { label: "Month PDF", href: exportHref("/api/export/report.pdf", monthRange) },
        ]}
      />
    </div>
  );
}
