import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import type { DirectoryUser, ProjectView, UserMonthRollup } from "@/contracts";
import { requireActor } from "@/server/auth/session";
import { getTeamMonthRollup } from "@/server/services/rollup-service";
import { listDirectory } from "@/server/services/directory-service";
import { listProjects } from "@/server/services/project-service";
import { monthWeeks } from "@/server/services/calendar";
import { firstDayOfMonth, lastDayOfMonth, parseMonthParam, todayIn } from "@/components/lib/dates";
import { exportHref } from "@/components/shell/export-href";
import { getCurrentProfile } from "@/components/shell/profile";
import { NoAccessPanel } from "@/components/shell/state-panels";
import { TeamHeader } from "@/components/team/team-header";
import { SummaryGrid } from "@/components/team/summary-grid";
import { parseTeamFilters, visibleUserIds } from "@/components/team/team-filters";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("metadata"))("team") };
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function TeamPage({ searchParams }: { searchParams: SearchParams }) {
  const actor = await requireActor();
  if (actor.role === "member") return <NoAccessPanel area="team" />;

  const [params, profile, t] = await Promise.all([searchParams, getCurrentProfile(), getTranslations("team")]);
  const today = todayIn(profile.timezone); // A12: the actor's own timezone
  const month = parseMonthParam(params.month, today);
  const [all, directory, projects]: [UserMonthRollup[], DirectoryUser[], ProjectView[]] = await Promise.all([
    getTeamMonthRollup(actor, month),
    listDirectory(actor),
    listProjects(actor),
  ]);
  const active = projects.filter((p) => p.isActive).sort((a, b) => a.name.localeCompare(b.name));
  const filters = parseTeamFilters(params.q, params.project, active.map((p) => p.id));
  const visible = visibleUserIds(all, directory, filters);
  const rows = all.filter((r) => visible.has(r.userId));
  const filtered = rows.length !== all.length;
  const weeks = monthWeeks(month);
  const week = weeks.find((w) => w.start <= today && today <= w.end) ?? weeks[0];
  const range = { from: firstDayOfMonth(month), to: lastDayOfMonth(month) };
  const weekRange = week ? { from: week.start, to: week.end } : range;

  return (
    <div className="flex flex-col gap-6">
      <TeamHeader
        month={month}
        today={today}
        drawerDate={null}
        filters={filters}
        projects={active.map((p) => ({ value: p.id, label: p.name }))}
        exports={{
          week: [
            { kind: "csv", href: exportHref("/api/export/ledger.csv", weekRange) },
            { kind: "pdf", href: exportHref("/api/export/report.pdf", weekRange) },
          ],
          month: [
            { kind: "csv", label: t("exports.summaryCsv"), href: exportHref("/api/export/summary.csv", { month }) },
            { kind: "csv", label: t("exports.ledgerCsv"), href: exportHref("/api/export/ledger.csv", range) },
            { kind: "pdf", href: exportHref("/api/export/report.pdf", range) },
          ],
        }}
      />
      {rows.length === 0 ? (
        <p className="rounded-lg border bg-card p-6 text-muted-foreground">{filtered ? t("noMatch") : t("empty")}</p>
      ) : (
        <SummaryGrid
          rows={rows}
          weeks={weeks}
          today={today}
          avatars={Object.fromEntries(directory.map((u) => [u.id, u.avatarUrl]))}
          selfId={actor.userId}
        />
      )}
    </div>
  );
}
