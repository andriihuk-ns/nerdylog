import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
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
import { getCurrentProfile } from "@/components/shell/profile";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("metadata"))("myTime") };
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function MyTimePage({ searchParams }: { searchParams: SearchParams }) {
  const actor = await requireActor();
  const [params, profile, t] = await Promise.all([searchParams, getCurrentProfile(), getTranslations("myTime.exports")]);
  const today = todayIn(profile.timezone); // A12: the actor's own timezone
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
          { label: t("weekCsv"), href: exportHref("/api/export/ledger.csv", week) },
          { label: t("weekPdf"), href: exportHref("/api/export/report.pdf", week) },
          { label: t("monthCsv"), href: exportHref("/api/export/ledger.csv", monthRange) },
          { label: t("monthPdf"), href: exportHref("/api/export/report.pdf", monthRange) },
        ]}
      />
    </div>
  );
}
