"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { ArrowLeft, CircleCheck, CircleX, Clock, Hash, RefreshCw, Users } from "lucide-react";
import { useTranslations } from "next-intl";
import type { OfficeView, ProjectView, SlackChannelOption, ProjectMemberAllocation } from "@/contracts";
import { refreshProjectMembersAction } from "@/app/(dashboard)/admin/project-actions";
import { Button } from "@/components/ui/button";
import { Toast } from "@/components/ui/toast";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { channelLabel } from "./channel-options";
import { useTableSort } from "@/hooks/use-table-sort";
import { SortableHead } from "@/components/shell/sortable-head";
import { ProjectMemberAllocationControl } from "./project-member-allocation";
import { useMemberRefreshText } from "./use-member-refresh-text";
import { CARD_FRAME, CARD_TABLE, TABLE_EDGE_PADDING } from "@/components/shell/table-styles";
import { cityName } from "./timezones";

interface Props {
  project: ProjectView;
  offices: OfficeView[];
  channels: SlackChannelOption[] | null;
}

export function ProjectDetailPanel({ project, offices, channels }: Props) {
  const t = useTranslations("admin.projects");
  const tc = useTranslations("common");
  const router = useRouter();
  const [refreshing, startRefresh] = useTransition();
  const refreshText = useMemberRefreshText();
  const { toast, show, dismiss } = useToast();
  const sort = useTableSort<ProjectMemberAllocation, "name" | "allocation">(project.memberAllocations, (m) => m.userId, {
    name: (m) => m.fullName,
    allocation: (m) => m.allocationHoursPerMonth,
  });
  const channel = project.slackChannelId ? channelLabel(channels, project.slackChannelId) : t("noChannel");
  const channelDisplay = channel.startsWith("#") ? channel.slice(1) : channel;

  const office = offices.find((o) => o.id === project.statusPromptOfficeId) ?? offices.find((o) => o.code === "UA");
  const asksAt = t("asksAt", { time: project.statusPromptTime, zone: cityName(project.statusPromptTimezone ?? office?.timezone ?? "Europe/Kyiv") });

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
      <Link href="/admin?tab=projects" className="inline-flex min-h-11 w-fit items-center gap-2 rounded-sm text-sm font-medium text-muted-foreground hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <ArrowLeft aria-hidden className="size-4" />
        {t("backToProjects")}
      </Link>

      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h1 id="project-detail-title" className="truncate text-2xl font-semibold tracking-tight">{project.name}</h1>
          <dl className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
            <div className="inline-flex items-center gap-1.5">
              <dt className="sr-only">{t("columns.channel")}</dt>
              <dd className="inline-flex items-center gap-1.5"><Hash aria-hidden className="size-4 shrink-0" />{channelDisplay}</dd>
            </div>
            <div className="inline-flex items-center gap-1.5">
              <dt className="sr-only">{t("team")}</dt>
              <dd className="inline-flex items-center gap-1.5" aria-label={t("memberCount", { count: project.memberAllocations.length })}>
                <Users aria-hidden className="size-4 shrink-0" />{t("memberCount", { count: project.memberAllocations.length })}
              </dd>
            </div>
            <div className="inline-flex items-center gap-1.5">
              <dt className="sr-only">{t("columns.prompt")}</dt>
              <dd className="tabular inline-flex items-center gap-1.5"><Clock aria-hidden className="size-4 shrink-0" />{asksAt}</dd>
            </div>
            <div className="inline-flex items-center gap-1.5">
              <dt className="sr-only">{t("columns.status")}</dt>
              <dd className="inline-flex items-center gap-1.5" aria-label={`${t("columns.status")}: ${project.isActive ? tc("active") : tc("archived")}`}>
                {project.isActive ? <CircleCheck aria-hidden className="size-4 shrink-0 text-work" /> : <CircleX aria-hidden className="size-4 shrink-0" />}
                {project.isActive ? tc("active") : tc("archived")}
              </dd>
            </div>
          </dl>
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
          <div className={cn("overflow-x-auto rounded-lg border bg-card", CARD_FRAME)}>
            <table className={cn("w-full border-collapse", CARD_TABLE, TABLE_EDGE_PADDING)}>
              <thead>
                <tr className="border-b text-xs font-medium text-muted-foreground">
                  <SortableHead {...sort.head("name")} className="sticky left-0 z-10 h-10 bg-card px-4 text-left font-medium">{t("columns.name")}</SortableHead>
                  <SortableHead {...sort.head("allocation")} className="px-3 text-left font-medium whitespace-nowrap">{t("allocationColumn")}</SortableHead>
                </tr>
              </thead>
              <tbody>
                {sort.apply(project.memberAllocations).map((member) => (
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
