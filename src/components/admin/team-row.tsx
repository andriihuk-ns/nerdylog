"use client";

import { useId, useOptimistic, useState, useTransition } from "react";
import type { DirectoryUser, SlackChannelOption, TeamView } from "@/contracts";
import { cn } from "@/lib/utils";
import { updateTeamChannelAction } from "@/app/(dashboard)/admin/actions";
import { ChannelPicker } from "./channel-picker";
import { channelErrorText, channelLabel, findChannel } from "./channel-options";
import { TeamMembers } from "./team-members";

interface Props {
  team: TeamView;
  members: DirectoryUser[];
  channels: SlackChannelOption[] | null;
  /** channelId → `@handle` of another team using it. */
  taken: Map<string, string>;
  onSaved: (message: string) => void;
}

/** One Teams row (A13). Picking a channel saves at once: optimistic, join-first, inline error + revert on failure. */
export function TeamRow({ team, members, channels, taken, onSaved }: Props) {
  const id = useId();
  const errorId = `${id}-error`;
  const [saved, setSaved] = useState(team.slackChannelId);
  const [value, setOptimistic] = useOptimistic(saved);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const archived = !team.isActive;

  function change(next: string | null) {
    if (next === value) return;
    setError(null);
    startTransition(async () => {
      setOptimistic(next);
      const res = await updateTeamChannelAction(team.id, next);
      if (res.ok) {
        setSaved(res.data.slackChannelId);
        const label = res.data.slackChannelId ? channelLabel(channels, res.data.slackChannelId) : null;
        onSaved(label ? `@${team.handle} standups now post to ${label}.` : `@${team.handle} channel removed.`);
      } else {
        setError("field" in res ? channelErrorText(res, findChannel(channels, next)?.name) : res.message);
      }
    });
  }

  return (
    <tr className={cn("border-b align-top last:border-b-0", archived && "text-muted-foreground")} aria-busy={pending || undefined}>
      <th scope="row" className="px-4 py-3 text-left font-medium">
        <span className="font-mono text-sm">@{team.handle}</span>
      </th>
      <td className="px-2 py-3">{team.name}</td>
      <td className="px-2 py-3">
        <TeamMembers members={members} />
      </td>
      <td className="w-80 px-4 py-2">
        {archived ? (
          <span className="block py-1 text-sm">{value ? channelLabel(channels, value) : "—"}</span>
        ) : (
          <div className="flex flex-col gap-1.5">
            <label htmlFor={id} className="sr-only">
              {`Slack channel for @${team.handle}`}
            </label>
            <ChannelPicker
              id={id}
              channels={channels}
              value={value}
              onChange={change}
              taken={taken}
              noneLabel="No channel"
              disabled={pending}
              invalid={Boolean(error)}
              aria-describedby={error ? errorId : undefined}
            />
            {error ? (
              <p id={errorId} role="alert" className="text-sm text-destructive">
                {error}
              </p>
            ) : null}
          </div>
        )}
      </td>
    </tr>
  );
}
