"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { ArrowLeft, RefreshCw, Users } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ProjectView, SlackChannelOption } from "@/contracts";
import { refreshProjectMembersAction } from "@/app/(dashboard)/admin/project-actions";
import { Button } from "@/components/ui/button";
import { Toast } from "@/components/ui/toast";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { channelLabel } from "./channel-options";
import { ProjectMemberAllocationControl } from "./project-member-allocation";
import { useMemberRefreshText } from "./use-member-refresh-text";

interface Props {
  project: ProjectView;
  channels: SlackChannelOption[] | null;
}

export function ProjectDetailPanel({ project, channels }: Props) {
  const t = useTranslations("admin.projects");
  const tc = useTranslations("common");
  const router = useRouter();
  const [refreshing, startRefresh] = useTransition();
  const refreshText = useMemberRefreshText();
  const { toast, show, dismiss } = useToast();
  const channel = project.slackChannelId ? channelLabel(channels, project.slackChannelId) : t("noChannel");

  function refreshMembers() {
    startRefresh(async () => {
      const result = await refreshProjectMembersAction(project.id);
      if (!result.ok) {
        show(t("refreshFailed", { name: project.name, reason: result.message }), { tone: "error", onRetry: refreshMembers });
        return;
      }
      const { text, warn } = refreshText(result.data, channel);
      show(text, warn ? { tone: "error", onRetry: refreshMembers } : {});
      if (!warn) router.refresh();
    });
  }

  return (
    <section className="flex flex-col gap-6" aria-labelledby="project-detail-title">
      <Link href="/admin?tab=projects" className="inline-flex min-h-11 w-fit items-center gap-2 rounded-sm text-sm font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <ArrowLeft aria-hidden className="size-4" />
        {t("backToProjects")}
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-4 border-b pb-5">
        <div className="min-w-0">
          <h1 id="project-detail-title" className="truncate text-2xl font-semibold tracking-tight">{project.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{channel} · {project.isActive ? tc("active") : tc("archived")}</p>
        </div>
        <Button onClick={refreshMembers} disabled={refreshing || !project.slackChannelId} className="hit-target" title={!project.slackChannelId ? t("refreshNeedsChannel") : undefined}>
          <RefreshCw aria-hidden className={cn(refreshing && "motion-safe:animate-spin")} />
          {refreshing ? t("refreshing") : t("refresh")}
        </Button>
      </header>

      <section className="flex flex-col gap-3" aria-labelledby="project-team-title">
        <div className="flex items-center gap-2">
          <Users aria-hidden className="size-5 text-muted-foreground" />
          <h2 id="project-team-title" className="text-lg font-semibold">
            {t("teamTitle", { count: project.memberAllocations.length })}
          </h2>
        </div>
        <p className="text-sm text-muted-foreground">{t("teamDescription")}</p>
        {project.memberAllocations.length > 0 ? (
          <ul className="grid gap-2 lg:grid-cols-2">
            {project.memberAllocations.map((member) => (
              <ProjectMemberAllocationControl
                key={member.userId}
                projectId={project.id}
                projectName={project.name}
                member={member}
                onToast={(message, tone) => show(message, { tone })}
              />
            ))}
          </ul>
        ) : (
          <div className="rounded-lg border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
            <Users aria-hidden className="mx-auto mb-2 size-5" />
            {t("noMembers")}
          </div>
        )}
      </section>
      <Toast toast={toast} onDismiss={dismiss} />
    </section>
  );
}
