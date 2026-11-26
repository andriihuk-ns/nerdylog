"use client";

import { ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
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

/** A13 Teams tab: Slack user groups with one standup channel each. Archived teams collapse below. */
export function TeamsPanel({ teams, users, channels }: Props) {
  const t = useTranslations("admin.teams");
  const tChannel = useTranslations("admin.channel");
  const { toast, show, dismiss } = useToast();
  const { active, archived } = splitTeams(teams);

  const table = (list: TeamView[], label: string) => (
    <div className="overflow-x-auto rounded-lg border bg-card">
      <table className="w-full border-collapse" aria-label={label}>
        <thead>
          <tr className="border-b text-xs font-medium text-muted-foreground">
            <th scope="col" className="h-10 px-4 text-left font-medium">
              {t("columns.handle")}
            </th>
            <th scope="col" className="px-2 text-left font-medium">
              {t("columns.name")}
            </th>
            <th scope="col" className="px-2 text-left font-medium">
              {t("columns.members")}
            </th>
            <th scope="col" className="px-4 text-left font-medium">
              {t("columns.channel")}
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
          {t("title")}
        </h2>
        <p className="max-w-2xl text-muted-foreground">{t("helper")}</p>
        {channels === null ? <p className="text-sm text-muted-foreground">{tChannel("connect")}</p> : null}
      </div>
      {active.length === 0 ? (
        <p className="rounded-lg border bg-card p-6 text-muted-foreground">
          {t("empty")}
        </p>
      ) : (
        table(active, t("activeLabel"))
      )}
      {archived.length > 0 ? (
        <details className="group flex flex-col gap-3">
          <summary className="hit-target flex w-fit cursor-pointer list-none items-center gap-1 rounded-sm text-sm font-medium text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring">
            <ChevronRight aria-hidden className="size-4 transition-transform group-open:rotate-90" />
            {t.rich("archivedToggle", { count: archived.length, n: (chunks) => <span className="tabular">{chunks}</span> })}
          </summary>
          <div className="mt-3">{table(archived, t("archivedLabel"))}</div>
        </details>
      ) : null}
      <Toast toast={toast} onDismiss={dismiss} />
    </section>
  );
}
