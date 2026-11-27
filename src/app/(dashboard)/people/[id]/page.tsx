import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import type { DirectoryUser, OfficeView, ProjectHours, ProjectView, UserMonthRollup } from "@/contracts";
import { requireActor } from "@/server/auth/session";
import { listDirectory } from "@/server/services/directory-service";
import { listOffices } from "@/server/services/office-service";
import { listProjects } from "@/server/services/project-service";
import { getProjectHours, getTeamMonthRollup } from "@/server/services/rollup-service";
import { getPtoBalance } from "@/server/services/pto-service";
import { listCalendarHolidayNames } from "@/server/services/holiday-service";
import { listWeekEntries } from "@/server/services/time-entry-service";
import { addDays, monthForWeek, parseWeekParam, todayIn } from "@/components/lib/dates";
import { ExportMenus } from "@/components/shell/export-menu";
import { rangeExports } from "@/components/shell/export-href";
import { PersonHeader } from "@/components/people/person-header";
import { MonthTotalsCard } from "@/components/people/month-totals-card";
import { PtoBalanceCard } from "@/components/my-time/pto-balance-card";
import { ProjectHoursCard } from "@/components/my-time/project-hours-card";
import { WeekView } from "@/components/my-time/week-view";
import { projectOptions } from "../../my-time/project-options";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("metadata"))("person") };
}

type Params = Promise<{ id: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** A16 people page (managers + admins; members go to /my-time): profile, PTO, totals, hours, status, editable week. */
export default async function PersonPage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const actor = await requireActor();
  if (actor.role === "member") redirect("/my-time");

  const [{ id }, query, t] = await Promise.all([params, searchParams, getTranslations("people")]);
  const [directory, offices]: [DirectoryUser[], OfficeView[]] = await Promise.all([listDirectory(actor), listOffices(actor)]);
  const user = directory.find((u) => u.id === id);
  if (!user) notFound();

  const today = todayIn(user.timezone); // the person's own calendar
  const weekStart = parseWeekParam(query.week, today);
  const weekEnd = addDays(weekStart, 6);
  const month = monthForWeek(weekStart, today);
  const [projects, rollup, hours, pto, entries, holidayNames]: [
    ProjectView[],
    UserMonthRollup[],
    ProjectHours[],
    Awaited<ReturnType<typeof getPtoBalance>>,
    Awaited<ReturnType<typeof listWeekEntries>>,
    Awaited<ReturnType<typeof listCalendarHolidayNames>>,
  ] = await Promise.all([
    listProjects(actor),
    getTeamMonthRollup(actor, month),
    getProjectHours(actor, month, user.id),
    getPtoBalance(actor, user.id, Number(today.slice(0, 4))),
    listWeekEntries(actor, user.id, weekStart),
    listCalendarHolidayNames(actor, user.id, weekStart, weekEnd),
  ]);
  const options = await projectOptions(projects, (p) => p.memberIds.includes(user.id), { kind: "other", name: user.fullName });
  const totals = rollup.find((r) => r.userId === user.id)?.total ?? null;

  // Directory and office pages are admin-only, so only an admin gets a link back to them.
  const from = actor.role === "admin" && (query.from === "directory" || query.from === "office") ? query.from : "team";

  return (
    <div className="flex flex-col gap-8">
      <PersonHeader user={user} office={offices.find((o) => o.id === user.officeId)} from={from} />
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
        holidayNames={holidayNames}
        projects={options}
        userId={user.id}
        basePath={`/people/${user.id}`}
        preserveParams={query.from === "team" || query.from === "directory" || query.from === "office" ? { from: query.from } : undefined}
        title={t("week", { name: user.fullName })}
        showTitle={false}
        actions={<ExportMenus groups={rangeExports({ from: weekStart, to: weekEnd }, month, { userIds: user.id })} />}
      />
    </div>
  );
}
