import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import type { ProjectHours, ProjectView } from "@/contracts";
import { requireActor } from "@/server/auth/session";
import { listWeekEntries } from "@/server/services/time-entry-service";
import { listProjects } from "@/server/services/project-service";
import { getProjectHours } from "@/server/services/rollup-service";
import { getPtoBalance } from "@/server/services/pto-service";
import { listCalendarHolidayNames } from "@/server/services/holiday-service";
import { addDays, monthForWeek, parseWeekParam, todayIn } from "@/components/lib/dates";
import { WeekView } from "@/components/my-time/week-view";
import { ProjectHoursCard } from "@/components/my-time/project-hours-card";
import { PtoBalanceCard } from "@/components/my-time/pto-balance-card";
import { ExportMenus } from "@/components/shell/export-menu";
import { rangeExports } from "@/components/shell/export-href";
import { getCurrentProfile } from "@/components/shell/profile";
import { projectOptions } from "./project-options";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("metadata"))("myTime") };
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function MyTimePage({ searchParams }: { searchParams: SearchParams }) {
  const actor = await requireActor();
  const [params, profile] = await Promise.all([searchParams, getCurrentProfile()]);
  const today = todayIn(profile.timezone); // A12: the actor's own timezone
  const weekStart = parseWeekParam(params.week, today);
  const weekEnd = addDays(weekStart, 6);
  const month = monthForWeek(weekStart, today);

  const [entries, projects, hours, pto, holidayNames] = await Promise.all([
    listWeekEntries(actor, actor.userId, weekStart),
    listProjects(actor),
    getProjectHours(actor, month),
    getPtoBalance(actor, actor.userId, Number(today.slice(0, 4))),
    listCalendarHolidayNames(actor, actor.userId, weekStart, weekEnd),
  ]);
  const options = await projectOptions(projects, (p: ProjectView) => p.isMember, { kind: "self" });
  const monthHours: ProjectHours[] = hours;

  return (
    <div className="flex flex-col gap-8">
      <WeekView
        key={weekStart}
        weekStart={weekStart}
        today={today}
        entries={entries}
        holidayNames={holidayNames}
        projects={options}
        storageUserId={actor.userId}
        actions={<ExportMenus groups={rangeExports({ from: weekStart, to: weekEnd }, month)} />}
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <ProjectHoursCard items={monthHours} month={month} />
        <PtoBalanceCard balance={pto} />
      </div>
    </div>
  );
}
