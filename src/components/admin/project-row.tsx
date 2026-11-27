"use client";

import { useTransition } from "react";
import { Lock, Pencil, RefreshCw, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import type { OfficeView, ProjectView, SlackChannelOption } from "@/contracts";
import { cn } from "@/lib/utils";
import { refreshProjectMembersAction } from "@/app/(dashboard)/admin/project-actions";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { channelLabel, findChannel } from "./channel-options";
import { useMemberRefreshText } from "./use-member-refresh-text";
import { ProjectMemberAllocationControl } from "./project-member-allocation";

interface Props {
  project: ProjectView;
  channels: SlackChannelOption[] | null;
  offices: OfficeView[];
  onEdit: () => void;
  onDelete: () => void;
  onToast: (message: string, tone: "neutral" | "error", retry?: () => void) => void;
}

/** One Projects row: name, #channel, prompt ("Asks at 10:00 · UA"), creator, members, status; Refresh, Edit, Delete. */
export function ProjectRow({ project: p, channels, offices, onEdit, onDelete, onToast }: Props) {
  const t = useTranslations("admin.projects");
  const tc = useTranslations("common");
  const refreshText = useMemberRefreshText();
  const [refreshing, startRefresh] = useTransition();
  const label = p.slackChannelId ? channelLabel(channels, p.slackChannelId) : null;
  const office = offices.find((o) => o.id === p.statusPromptOfficeId) ?? offices.find((o) => o.code === "UA");

  function refreshMembers() {
    startRefresh(async () => {
      const res = await refreshProjectMembersAction(p.id);
      if (!res.ok) return onToast(t("refreshFailed", { name: p.name, reason: res.message }), "error", refreshMembers);
      const { text, warn } = refreshText(res.data, label ?? "");
      onToast(text, warn ? "error" : "neutral", warn ? refreshMembers : undefined);
    });
  }

  return (
    <tr className={cn("h-11 border-b last:border-b-0", !p.isActive && "text-muted-foreground")}>
      <th scope="row" className="sticky left-0 z-10 max-w-48 truncate bg-card px-4 text-left font-medium">
        {p.name}
      </th>
      <td className="px-3 whitespace-nowrap">
        <ChannelCell channels={channels} channelId={p.slackChannelId} />
      </td>
      <td className="tabular px-3 text-sm whitespace-nowrap text-muted-foreground">
        {t("asksAt", { time: p.statusPromptTime, office: office?.code ?? "UA" })}
      </td>
      <td className="px-3 whitespace-nowrap">{p.createdBy?.fullName ?? <span className="text-muted-foreground">—</span>}</td>
      <td className="px-3 py-2 align-top">
        {p.memberAllocations.length > 0 ? (
          <ul className="flex flex-col gap-1.5">
            {p.memberAllocations.map((member) => (
              <ProjectMemberAllocationControl
                key={member.userId}
                projectId={p.id}
                projectName={p.name}
                member={member}
                onToast={onToast}
              />
            ))}
          </ul>
        ) : <span className="text-sm text-muted-foreground">{t("noMembers")}</span>}
      </td>
      <td className="px-3">{p.isActive ? tc("active") : tc("archived")}</td>
      <td className="px-2">
        <span className="flex justify-end gap-1">
          <Button
            variant="ghost"
            className="hit-target"
            onClick={refreshMembers}
            disabled={refreshing || !p.slackChannelId}
            title={p.slackChannelId ? undefined : t("refreshNeedsChannel")}
          >
            <RefreshCw aria-hidden className={cn(refreshing && "motion-safe:animate-spin")} />
            <span className="sr-only sm:not-sr-only">{refreshing ? t("refreshing") : t("refresh")}</span>
          </Button>
          <Button variant="ghost" size="icon" className="hit-target" onClick={onEdit} aria-label={t("edit", { name: p.name })}>
            <Pencil aria-hidden />
          </Button>
          <DeleteButton project={p} onDelete={onDelete} />
        </span>
      </td>
    </tr>
  );
}

/** Disabled with a tooltip while the project has logged hours (archive instead). */
function DeleteButton({ project, onDelete }: { project: ProjectView; onDelete: () => void }) {
  const t = useTranslations("admin.projects");
  const button = (
    <Button
      variant="ghost"
      size="icon"
      className="hit-target"
      onClick={onDelete}
      disabled={project.hasTimeEntries}
      aria-label={project.hasTimeEntries ? `${t("delete", { name: project.name })}. ${t("deleteBlocked")}` : t("delete", { name: project.name })}
    >
      <Trash2 aria-hidden />
    </Button>
  );
  if (!project.hasTimeEntries) return button;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span tabIndex={0} className="inline-flex rounded-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
          {button}
        </span>
      </TooltipTrigger>
      <TooltipContent>{t("deleteBlocked")}</TooltipContent>
    </Tooltip>
  );
}

function ChannelCell({ channels, channelId }: { channels: SlackChannelOption[] | null; channelId: string | null }) {
  const t = useTranslations("admin");
  if (!channelId) return <span className="text-muted-foreground">{t("projects.noChannel")}</span>;
  const channel = findChannel(channels, channelId);
  return (
    <span className="inline-flex items-center gap-1">
      {channel?.isPrivate ? <Lock aria-label={t("channel.private")} className="size-3.5" /> : null}
      <span className={channel ? undefined : "font-mono text-xs"}>{channelLabel(channels, channelId)}</span>
      {channel && !channel.isMember ? <span className="text-xs text-muted-foreground">{t("projects.botNotIn")}</span> : null}
    </span>
  );
}
