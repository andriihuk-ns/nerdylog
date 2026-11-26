import type { Metadata } from "next";
import { Suspense } from "react";
import type { UserMonthRollup } from "@/contracts";
import { requireActor } from "@/server/auth/session";
import { getTeamMonthRollup } from "@/server/services/rollup-service";
import { monthWeeks } from "@/server/services/calendar";
import { firstDayOfMonth, lastDayOfMonth, parseDateParam, parseMonthParam, todayIn } from "@/components/lib/dates";
import { exportHref } from "@/components/shell/export-links";
import { getCurrentProfile } from "@/components/shell/profile";
import { NoAccessPanel } from "@/components/shell/state-panels";
import { TeamHeader } from "@/components/team/team-header";
import { SummaryGrid } from "@/components/team/summary-grid";
import { DrawerShell } from "@/components/team/drawer-shell";
import { StandupList, StandupListSkeleton } from "@/components/team/standup-list";

export const metadata: Metadata = { title: "Team" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function TeamPage({ searchParams }: { searchParams: SearchParams }) {
  const actor = await requireActor();
  if (actor.role === "member") return <NoAccessPanel area="Team" />;

  const [params, profile] = await Promise.all([searchParams, getCurrentProfile()]);
  const today = todayIn(profile.timezone); // A12: the actor's own timezone
  const month = parseMonthParam(params.month, today);
  const drawerDate = parseDateParam(params.date); // drawer open iff ?date=
  const rows: UserMonthRollup[] = await getTeamMonthRollup(actor, month);
  const weeks = monthWeeks(month);
  const range = { from: firstDayOfMonth(month), to: lastDayOfMonth(month) };
  const roster = rows.map((r) => ({ userId: r.userId, fullName: r.fullName }));

  return (
    <div className="flex flex-col gap-6">
      <TeamHeader
        month={month}
        today={today}
        drawerDate={drawerDate}
        exports={[
          { label: "Summary CSV", href: exportHref("/api/export/summary.csv", { month }) },
          { label: "Ledger CSV", href: exportHref("/api/export/ledger.csv", range) },
          { label: "PDF", href: exportHref("/api/export/report.pdf", range) },
        ]}
      />
      <div className="flex items-start gap-6">
        <div className="min-w-0 flex-1">
          {rows.length === 0 ? (
            <p className="rounded-lg border bg-card p-6 text-muted-foreground">
              No teammates in this view. Admins can sync from Slack in Admin.
            </p>
          ) : (
            <SummaryGrid rows={rows} weeks={weeks} today={today} />
          )}
        </div>
        {drawerDate ? (
          <DrawerShell date={drawerDate} month={month}>
            <Suspense key={drawerDate} fallback={<StandupListSkeleton />}>
              <StandupList date={drawerDate} roster={roster} />
            </Suspense>
          </DrawerShell>
        ) : null}
      </div>
    </div>
  );
}
