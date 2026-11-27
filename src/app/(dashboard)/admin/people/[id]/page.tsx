import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import type { CheckinView, DirectoryUser, OfficeView, ProjectHours, ProjectView, UserMonthRollup } from "@/contracts";
import { requireActor } from "@/server/auth/session";
import { listDirectory } from "@/server/services/directory-service";
import { listOffices } from "@/server/services/office-service";
import { listProjects } from "@/server/services/project-service";
import { getProjectHours, getTeamMonthRollup } from "@/server/services/rollup-service";
import { getPtoBalance } from "@/server/services/pto-service";
import { listCheckinsForUser } from "@/server/services/checkin-service";
import { listWeekEntries } from "@/server/services/time-entry-service";
import { addDays, monthForWeek, parseWeekParam, todayIn } from "@/components/lib/dates";
import { NoAccessPanel } from "@/components/shell/state-panels";
import { ExportMenus } from "@/components/shell/export-menu";
import { rangeExports } from "@/components/shell/export-href";
import { PersonHeader } from "@/components/people/person-header";
import { MonthTotalsCard } from "@/components/people/month-totals-card";
import { RecentStandups } from "@/components/people/recent-standups";
import { PtoBalanceCard } from "@/components/my-time/pto-balance-card";
import { ProjectHoursCard } from "@/components/my-time/project-hours-card";
import { WeekView } from "@/components/my-time/week-view";
import { projectOptions } from "../../../my-time/project-options";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("metadata"))("person") };
}

type Params = Promise<{ id: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** A15 people page (admin only): profile, PTO, month totals, hours by project, recent standups, editable week. */
export default async function PersonPage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const actor = await requireActor();
  if (actor.role !== "admin") return <NoAccessPanel area="admin" />;

  const [{ id }, query, t] = await Promise.all([params, searchParams, getTranslations("people")]);
  const [directory, offices]: [DirectoryUser[], OfficeView[]] = await Promise.all([listDirectory(actor), listOffices(actor)]);
  const user = directory.find((u) => u.id === id);
  if (!user) notFound();

  const today = todayIn(user.timezone); // the person's own calendar
  const weekStart = parseWeekParam(query.week, today);
  const weekEnd = addDays(weekStart, 6);
  const month = monthForWeek(weekStart, today);
  const [projects, rollup, hours, pto, checkins, entries]: [
    ProjectView[],
    UserMonthRollup[],
    ProjectHours[],
    Awaited<ReturnType<typeof getPtoBalance>>,
    CheckinView[],
    Awaited<ReturnType<typeof listWeekEntries>>,
  ] = await Promise.all([
    listProjects(actor),
    getTeamMonthRollup(actor, month),
    getProjectHours(actor, month, user.id),
    getPtoBalance(actor, user.id, Number(today.slice(0, 4))),
    listCheckinsForUser(actor, user.id, addDays(today, -13), today),
    listWeekEntries(actor, user.id, weekStart),
  ]);
  const options = await projectOptions(projects, (p) => p.memberIds.includes(user.id), { kind: "other", name: user.fullName });
  const totals = rollup.find((r) => r.userId === user.id)?.total ?? null;

  return (
    <div className="flex flex-col gap-8">
      <PersonHeader user={user} office={offices.find((o) => o.id === user.officeId)} />
      <div className="grid gap-6 lg:grid-cols-3">
        <MonthTotalsCard totals={totals} month={month} />
        <ProjectHoursCard items={hours} month={month} />
        <PtoBalanceCard balance={pto} />
      </div>
      <WeekView
        key={weekStart}
        weekStart={weekStart}
        today={today}
        entries={entries}
        projects={options}
        userId={user.id}
        basePath={`/admin/people/${user.id}`}
        title={t("week", { name: user.fullName })}
      />
      <ExportMenus groups={rangeExports({ from: weekStart, to: weekEnd }, month, { userIds: user.id })} />
      <RecentStandups checkins={checkins} />
    </div>
  );
}
