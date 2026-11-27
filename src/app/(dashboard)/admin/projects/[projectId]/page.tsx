import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import type { ProjectView } from "@/contracts";
import { requireActor } from "@/server/auth/session";
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
  const [projects, channels]: [ProjectView[], Awaited<ReturnType<typeof loadSlackChannels>>] = await Promise.all([
    listProjects(actor, { includeArchived: true }),
    loadSlackChannels(),
  ]);
  const project = projects.find((item) => item.id === projectId);
  if (!project) notFound();

  return <ProjectDetailPanel project={project} channels={channels} />;
}
