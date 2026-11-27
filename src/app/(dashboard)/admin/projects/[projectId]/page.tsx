import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import type { ProjectView } from "@/contracts";
import { requireActor } from "@/server/auth/session";
import { listOffices } from "@/server/services/office-service";
import { listProjects } from "@/server/services/project-service";
import { NoAccessPanel } from "@/components/shell/state-panels";
import { ProjectDetailPanel } from "@/components/admin/project-detail-panel";
import { loadSlackChannels } from "../../load-channels";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("metadata"))("admin") };
}

export default async function ProjectDetailPage({ params }: { params: Promise<{ projectId: string }> }) {
  const actor = await requireActor();
  if (actor.role !== "admin") return <NoAccessPanel area="admin" />;

  const { projectId } = await params;
  const [projects, offices, channels] = await Promise.all([
    listProjects(actor, { includeArchived: true }),
    listOffices(actor),
    loadSlackChannels(),
  ]);
  const project = projects.find((item) => item.id === projectId);
  if (!project) notFound();

  return <ProjectDetailPanel project={project} offices={offices} channels={channels} />;
}
