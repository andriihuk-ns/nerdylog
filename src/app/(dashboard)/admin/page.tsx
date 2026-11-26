import type { Metadata } from "next";
import type { DirectoryUser, HolidayView, ProjectView } from "@/contracts";
import { requireActor } from "@/server/auth/session";
import { listDirectory } from "@/server/services/directory-service";
import { listProjects } from "@/server/services/project-service";
import { listHolidays } from "@/server/services/holiday-service";
import { todayIn } from "@/components/lib/dates";
import { NoAccessPanel } from "@/components/shell/state-panels";
import { AdminTabs, parseAdminTab } from "@/components/admin/admin-tabs";
import { DirectoryPanel } from "@/components/admin/directory-panel";
import { ProjectsPanel } from "@/components/admin/projects-panel";
import { HolidaysPanel } from "@/components/admin/holidays-panel";

export const metadata: Metadata = { title: "Admin" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function parseYear(value: unknown, fallback: number): number {
  const n = typeof value === "string" && /^\d{4}$/.test(value) ? Number(value) : NaN;
  return n >= 2000 && n <= 2100 ? n : fallback;
}

export default async function AdminPage({ searchParams }: { searchParams: SearchParams }) {
  const actor = await requireActor();
  if (actor.role !== "admin") return <NoAccessPanel area="Admin" />;

  const params = await searchParams;
  const currentYear = Number(todayIn().slice(0, 4));
  const year = parseYear(params.year, currentYear);
  const [users, projects, holidays]: [DirectoryUser[], ProjectView[], HolidayView[]] = await Promise.all([
    listDirectory(actor),
    listProjects(actor, { includeArchived: true }),
    listHolidays(actor, year),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-[-0.01em]">Admin</h1>
      <AdminTabs
        tab={parseAdminTab(params.tab)}
        year={year}
        panels={{
          directory: <DirectoryPanel users={users} />,
          projects: <ProjectsPanel projects={projects} />,
          holidays: <HolidaysPanel key={year} holidays={holidays} year={year} currentYear={currentYear} />,
        }}
      />
    </div>
  );
}
