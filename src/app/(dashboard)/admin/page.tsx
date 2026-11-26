import type { Metadata } from "next";
import type { AppSettings, DirectoryUser, HolidayView, ProjectView, SlackChannelOption, TeamView } from "@/contracts";
import { requireActor } from "@/server/auth/session";
import { listDirectory } from "@/server/services/directory-service";
import { listProjects } from "@/server/services/project-service";
import { listHolidays } from "@/server/services/holiday-service";
import { getAppSettings } from "@/server/services/settings-service";
import { listTeams } from "@/server/services/team-service";
import { todayIn } from "@/components/lib/dates";
import { NoAccessPanel } from "@/components/shell/state-panels";
import { getCurrentProfile } from "@/components/shell/profile";
import { AdminTabs } from "@/components/admin/admin-tabs";
import { parseAdminTab } from "@/components/admin/admin-tab";
import { DirectoryPanel } from "@/components/admin/directory-panel";
import { ProjectsPanel } from "@/components/admin/projects-panel";
import { HolidaysPanel } from "@/components/admin/holidays-panel";
import { SettingsPanel } from "@/components/admin/settings-panel";
import { TeamsPanel } from "@/components/admin/teams-panel";
import { loadSlackChannels } from "./load-channels";

export const metadata: Metadata = { title: "Admin" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function parseYear(value: unknown, fallback: number): number {
  const n = typeof value === "string" && /^\d{4}$/.test(value) ? Number(value) : NaN;
  return n >= 2000 && n <= 2100 ? n : fallback;
}

export default async function AdminPage({ searchParams }: { searchParams: SearchParams }) {
  const actor = await requireActor();
  if (actor.role !== "admin") return <NoAccessPanel area="Admin" />;

  const [params, profile] = await Promise.all([searchParams, getCurrentProfile()]);
  const tab = parseAdminTab(params.tab);
  const currentYear = Number(todayIn(profile.timezone).slice(0, 4));
  const year = parseYear(params.year, currentYear);
  const [users, teams, projects, holidays, settings, channels]: [
    DirectoryUser[],
    TeamView[],
    ProjectView[],
    HolidayView[],
    AppSettings,
    SlackChannelOption[] | null,
  ] = await Promise.all([
    listDirectory(actor),
    listTeams(actor, { includeArchived: true }),
    listProjects(actor, { includeArchived: true }),
    listHolidays(actor, year),
    getAppSettings(actor),
    // Only the Teams/Projects/Settings pickers need Slack channels (Tier 2 rate limits).
    tab === "directory" || tab === "holidays" ? Promise.resolve(null) : loadSlackChannels(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-[-0.01em]">Admin</h1>
      <AdminTabs
        tab={tab}
        year={year}
        panels={{
          directory: <DirectoryPanel users={users} teams={teams} />,
          teams: <TeamsPanel teams={teams} users={users} channels={channels} />,
          projects: <ProjectsPanel projects={projects} channels={channels} />,
          holidays: <HolidaysPanel key={year} holidays={holidays} year={year} currentYear={currentYear} />,
          settings: <SettingsPanel settings={settings} channels={channels} />,
        }}
      />
    </div>
  );
}
