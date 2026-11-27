import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import type { DirectoryUser, OfficeView, ProjectView, SlackChannelOption } from "@/contracts";
import { requireActor } from "@/server/auth/session";
import { listDirectory } from "@/server/services/directory-service";
import { listProjects } from "@/server/services/project-service";
import { listOffices } from "@/server/services/office-service";
import { NoAccessPanel } from "@/components/shell/state-panels";
import { AdminTabs } from "@/components/admin/admin-tabs";
import { parseAdminTab } from "@/components/admin/admin-tab";
import { DirectoryPanel } from "@/components/admin/directory-panel";
import { ProjectsPanel } from "@/components/admin/projects-panel";
import { OfficesPanel } from "@/components/admin/offices-panel";
import { loadSlackChannels } from "./load-channels";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("metadata"))("admin") };
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function AdminPage({ searchParams }: { searchParams: SearchParams }) {
  const actor = await requireActor();
  if (actor.role !== "admin") return <NoAccessPanel area="admin" />;

  const [params, t] = await Promise.all([searchParams, getTranslations("metadata")]);
  const tab = parseAdminTab(params.tab);
  const needsChannels = tab === "projects"; // Slack Tier 2 rate limits
  const [users, projects, offices, channels]: [DirectoryUser[], ProjectView[], OfficeView[], SlackChannelOption[] | null] =
    await Promise.all([
      listDirectory(actor),
      listProjects(actor, { includeArchived: true }),
      listOffices(actor),
      needsChannels ? loadSlackChannels() : Promise.resolve(null),
    ]);
  return (
    <div className="flex flex-col gap-6">
      <h1 className="sr-only">{t("admin")}</h1>
      <AdminTabs
        tab={tab}
        panels={{
          directory: <DirectoryPanel users={users} projects={projects.filter((p) => p.isActive)} offices={offices} />,
          projects: <ProjectsPanel projects={projects} channels={channels} offices={offices} />,
          offices: <OfficesPanel offices={offices} />,
        }}
      />
    </div>
  );
}
