"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { ArrowLeft, RefreshCw } from "lucide-react";
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
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span>{channel}</span>
            <span className={cn("rounded-md px-2 py-1 text-xs font-medium", project.isActive ? "bg-work-subtle text-work" : "bg-muted text-muted-foreground")}>
              {project.isActive ? tc("active") : tc("archived")}
            </span>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={refreshMembers}
          disabled={refreshing || !project.slackChannelId}
          className="hit-target"
          title={!project.slackChannelId ? t("refreshNeedsChannel") : t("refresh")}
          aria-label={refreshing ? t("refreshing") : t("refresh")}
        >
          <RefreshCw aria-hidden className={cn(refreshing && "motion-safe:animate-spin")} />
        </Button>
      </header>

      <section className="flex flex-col gap-3" aria-label={t("team")}>
        {project.memberAllocations.length > 0 ? (
          <div className="overflow-x-auto rounded-lg border bg-card">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b text-xs font-medium text-muted-foreground">
                  <th scope="col" className="sticky left-0 z-10 h-10 bg-card px-4 text-left font-medium">{t("columns.name")}</th>
                  <th scope="col" className="px-3 text-left font-medium whitespace-nowrap">{t("allocationColumn")}</th>
                </tr>
              </thead>
              <tbody>
                {project.memberAllocations.map((member) => (
                  <ProjectMemberAllocationControl
                    key={member.userId}
                    projectId={project.id}
                    projectName={project.name}
                    member={member}
                    onToast={(message, tone) => show(message, { tone })}
                  />
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">{t("noMembers")}</p>
        )}
      </section>
      <Toast toast={toast} onDismiss={dismiss} />
    </section>
  );
}
