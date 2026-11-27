"use client";

import { useTransition } from "react";
import { Lock, Pencil, RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ProjectView, SlackChannelOption } from "@/contracts";
import { cn } from "@/lib/utils";
import { refreshProjectMembersAction } from "@/app/(dashboard)/admin/project-actions";
import { Button } from "@/components/ui/button";
import { useFormat } from "@/hooks/use-format";
import { channelLabel, findChannel } from "./channel-options";
import { useMemberRefreshText } from "./use-member-refresh-text";

interface Props {
  project: ProjectView;
  channels: SlackChannelOption[] | null;
  onEdit: () => void;
  onToast: (message: string, tone: "neutral" | "error", retry?: () => void) => void;
}

/** One Projects row: name, #channel, creator, member count, Refresh members, Edit. */
export function ProjectRow({ project: p, channels, onEdit, onToast }: Props) {
  const t = useTranslations("admin.projects");
  const tc = useTranslations("common");
  const f = useFormat();
  const refreshText = useMemberRefreshText();
  const [refreshing, startRefresh] = useTransition();
  const label = p.slackChannelId ? channelLabel(channels, p.slackChannelId) : null;

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
      <th scope="row" className="px-4 text-left font-medium">
        {p.name}
      </th>
      <td className="px-3">
        <ChannelCell channels={channels} channelId={p.slackChannelId} />
      </td>
      <td className="px-3">{p.createdBy?.fullName ?? <span className="text-muted-foreground">—</span>}</td>
      <td className="tabular px-3 text-right font-medium">{f.count(p.memberIds.length)}</td>
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
        </span>
      </td>
    </tr>
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
