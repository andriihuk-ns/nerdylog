import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import type { DirectoryUser, HolidayView, OfficeView, ProjectView, SlackChannelOption } from "@/contracts";
import { requireActor } from "@/server/auth/session";
import { listDirectory } from "@/server/services/directory-service";
import { listProjects } from "@/server/services/project-service";
import { listHolidays } from "@/server/services/holiday-service";
import { listOffices } from "@/server/services/office-service";
import { todayIn } from "@/components/lib/dates";
import { NoAccessPanel } from "@/components/shell/state-panels";
import { getCurrentProfile } from "@/components/shell/profile";
import { AdminTabs } from "@/components/admin/admin-tabs";
import { parseAdminTab } from "@/components/admin/admin-tab";
import { DirectoryPanel } from "@/components/admin/directory-panel";
import { ProjectsPanel } from "@/components/admin/projects-panel";
import { OfficesPanel } from "@/components/admin/offices-panel";
import { HolidaysPanel } from "@/components/admin/holidays-panel";
import { loadSlackChannels } from "./load-channels";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("metadata"))("admin") };
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function parseYear(value: unknown, fallback: number): number {
  const n = typeof value === "string" && /^\d{4}$/.test(value) ? Number(value) : NaN;
  return n >= 2000 && n <= 2100 ? n : fallback;
}

/** `?office=` when it names a known office, else the first one in the admin's order (A30). */
function pickOffice(offices: OfficeView[], value: unknown): string | null {
  return offices.find((o) => o.id === value)?.id ?? offices[0]?.id ?? null;
}

export default async function AdminPage({ searchParams }: { searchParams: SearchParams }) {
  const actor = await requireActor();
  if (actor.role !== "admin") return <NoAccessPanel area="admin" />;

  const [params, profile, t] = await Promise.all([searchParams, getCurrentProfile(), getTranslations("metadata")]);
  const tab = parseAdminTab(params.tab);
  const currentYear = Number(todayIn(profile.timezone).slice(0, 4));
  const year = parseYear(params.year, currentYear);
  const needsChannels = tab === "projects"; // Slack Tier 2 rate limits
  const [users, projects, offices, channels]: [DirectoryUser[], ProjectView[], OfficeView[], SlackChannelOption[] | null] =
    await Promise.all([
      listDirectory(actor),
      listProjects(actor, { includeArchived: true }),
      listOffices(actor),
      needsChannels ? loadSlackChannels() : Promise.resolve(null),
    ]);
  const officeId = pickOffice(offices, params.office);
  const holidays: HolidayView[] = officeId ? await listHolidays(actor, year, officeId) : [];

  return (
    <div className="flex flex-col gap-6">
      <h1 className="sr-only">{t("admin")}</h1>
      <AdminTabs
        tab={tab}
        year={year}
        officeId={officeId}
        panels={{
          directory: <DirectoryPanel users={users} projects={projects.filter((p) => p.isActive)} offices={offices} />,
          projects: <ProjectsPanel projects={projects} channels={channels} offices={offices} />,
          offices: <OfficesPanel offices={offices} />,
          holidays: (
            <HolidaysPanel key={`${officeId}-${year}`} holidays={holidays} offices={offices} officeId={officeId} year={year} currentYear={currentYear} />
          ),
        }}
      />
    </div>
  );
}
