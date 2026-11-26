"use client";

import { ChevronRight } from "lucide-react";
import type { DirectoryUser, SlackChannelOption, TeamView } from "@/contracts";
import { useToast } from "@/hooks/use-toast";
import { Toast } from "@/components/ui/toast";
import { TeamRow } from "./team-row";
import { resolveMembers, splitTeams, takenTeamChannels } from "./team-helpers";

interface Props {
  teams: TeamView[];
  users: DirectoryUser[];
  channels: SlackChannelOption[] | null;
}

const HELPER =
  "Teams mirror Slack user groups. A member's morning standup goes to each of their teams' channels; members without a team channel use the general standup channel.";

/** A13 Teams tab: Slack user groups with one standup channel each. Archived teams collapse below. */
export function TeamsPanel({ teams, users, channels }: Props) {
  const { toast, show, dismiss } = useToast();
  const { active, archived } = splitTeams(teams);

  const table = (list: TeamView[], label: string) => (
    <div className="overflow-x-auto rounded-lg border bg-card">
      <table className="w-full border-collapse" aria-label={label}>
        <thead>
          <tr className="border-b text-xs font-medium text-muted-foreground">
            <th scope="col" className="h-10 px-4 text-left font-medium">
              Handle
            </th>
            <th scope="col" className="px-2 text-left font-medium">
              Name
            </th>
            <th scope="col" className="px-2 text-left font-medium">
              Members
            </th>
            <th scope="col" className="px-4 text-left font-medium">
              Standup channel
            </th>
          </tr>
        </thead>
        <tbody>
          {list.map((t) => (
            <TeamRow
              key={`${t.id}:${t.slackChannelId ?? ""}`}
              team={t}
              members={resolveMembers(t.memberIds, users)}
              channels={channels}
              taken={takenTeamChannels(teams, t.id)}
              onSaved={(m) => show(m)}
            />
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <section aria-labelledby="teams-title" className="flex flex-col gap-4">
      <div>
        <h2 id="teams-title" className="text-lg font-semibold">
          Teams
        </h2>
        <p className="max-w-2xl text-muted-foreground">{HELPER}</p>
        {channels === null ? <p className="text-sm text-muted-foreground">Connect the Slack app to choose channels.</p> : null}
      </div>
      {active.length === 0 ? (
        <p className="rounded-lg border bg-card p-6 text-muted-foreground">
          No teams yet. Use “Sync from Slack” on the Directory tab to import your Slack user groups.
        </p>
      ) : (
        table(active, "Active teams")
      )}
      {archived.length > 0 ? (
        <details className="group flex flex-col gap-3">
          <summary className="hit-target flex w-fit cursor-pointer list-none items-center gap-1 rounded-sm text-sm font-medium text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring">
            <ChevronRight aria-hidden className="size-4 transition-transform group-open:rotate-90" />
            Archived (<span className="tabular">{archived.length}</span>)
          </summary>
          <div className="mt-3">{table(archived, "Archived teams")}</div>
        </details>
      ) : null}
      <Toast toast={toast} onDismiss={dismiss} />
    </section>
  );
}
