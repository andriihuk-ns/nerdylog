"use client";

import { useState } from "react";
import { Lock, Pencil, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ProjectView, SlackChannelOption } from "@/contracts";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Toast } from "@/components/ui/toast";
import { useFormat } from "@/hooks/use-format";
import { ProjectForm } from "./project-form";
import { channelLabel, findChannel, takenChannelMap } from "./channel-options";

/** FR-WEB-06 Projects & Caps. Archived projects stay listed (muted) so they can be re-activated. */
export function ProjectsPanel({ projects, channels }: { projects: ProjectView[]; channels: SlackChannelOption[] | null }) {
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const { toast, show, dismiss } = useToast();
  const t = useTranslations("admin.projects");
  const tc = useTranslations("common");
  const f = useFormat();
  const sorted = [...projects].sort((a, b) => Number(b.isActive) - Number(a.isActive) || a.name.localeCompare(b.name));
  const done = (message: string) => {
    setEditing(null);
    show(message);
  };

  return (
    <section aria-labelledby="projects-title" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="projects-title" className="text-lg font-semibold">
          {t("title")}
        </h2>
        <Button onClick={() => setEditing("new")} disabled={editing === "new"} className="hit-target">
          <Plus aria-hidden />
          {t("new")}
        </Button>
      </div>
      <div className="overflow-x-auto rounded-lg border bg-card">
        {editing === "new" ? (
          <div className="border-b">
            <ProjectForm channels={channels} taken={takenChannelMap(projects)} onDone={done} onCancel={() => setEditing(null)} />
          </div>
        ) : null}
        {sorted.length === 0 && editing !== "new" ? (
          <p className="p-6 text-muted-foreground">{t("empty")}</p>
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b text-xs font-medium text-muted-foreground">
                <th scope="col" className="h-10 px-4 text-left font-medium">{t("columns.name")}</th>
                <th scope="col" className="px-3 text-left font-medium">{t("columns.code")}</th>
                <th scope="col" className="px-3 text-right font-medium">{t("columns.cap")}</th>
                <th scope="col" className="px-3 text-left font-medium">{t("columns.channel")}</th>
                <th scope="col" className="px-3 text-left font-medium">{t("columns.billable")}</th>
                <th scope="col" className="px-3 text-left font-medium">{t("columns.status")}</th>
                <th scope="col" className="px-4 text-right font-medium">
                  <span className="sr-only">{t("columns.actions")}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((p) =>
                editing === p.id ? (
                  <tr key={p.id} className="border-b last:border-b-0">
                    <td colSpan={7}>
                      <ProjectForm project={p} channels={channels} taken={takenChannelMap(projects, p.id)} onDone={done} onCancel={() => setEditing(null)} />
                    </td>
                  </tr>
                ) : (
                  <tr key={p.id} className={cn("h-11 border-b last:border-b-0", !p.isActive && "text-muted-foreground")}>
                    <th scope="row" className="px-4 text-left font-medium">{p.name}</th>
                    <td className="px-3 font-mono text-xs">{p.code ?? "—"}</td>
                    <td className="tabular px-3 text-right font-medium">
                      {p.monthlyHourCap === null ? (
                        <span className="text-muted-foreground">{t("noCap")}</span>
                      ) : (
                        tc("hours", { value: f.hours(p.monthlyHourCap) })
                      )}
                    </td>
                    <td className="px-3">
                      <ChannelCell channels={channels} channelId={p.slackChannelId} />
                    </td>
                    <td className="px-3">{p.isBillable ? t("billable") : t("nonBillable")}</td>
                    <td className="px-3">{p.isActive ? tc("active") : tc("archived")}</td>
                    <td className="px-2 text-right">
                      <Button variant="ghost" size="icon" className="hit-target" onClick={() => setEditing(p.id)} aria-label={t("edit", { name: p.name })}>
                        <Pencil aria-hidden />
                      </Button>
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        )}
      </div>
      <Toast toast={toast} onDismiss={dismiss} />
    </section>
  );
}

function ChannelCell({ channels, channelId }: { channels: SlackChannelOption[] | null; channelId: string | null }) {
  const t = useTranslations("admin");
  if (!channelId) return <span className="text-muted-foreground">—</span>;
  const channel = findChannel(channels, channelId);
  return (
    <span className="inline-flex items-center gap-1">
      {channel?.isPrivate ? <Lock aria-label={t("channel.private")} className="size-3.5" /> : null}
      <span className={channel ? undefined : "font-mono text-xs"}>{channelLabel(channels, channelId)}</span>
      {channel && !channel.isMember ? <span className="text-xs text-muted-foreground">{t("projects.botNotIn")}</span> : null}
    </span>
  );
}
