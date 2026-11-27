"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ProjectView, SlackChannelOption } from "@/contracts";
import type { ProjectSaveResult } from "@/app/(dashboard)/admin/project-actions";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Toast } from "@/components/ui/toast";
import { ProjectForm } from "./project-form";
import { ProjectRow } from "./project-row";
import { channelLabel, takenChannelMap } from "./channel-options";
import { useMemberRefreshText } from "./use-member-refresh-text";

const COLUMNS = ["name", "channel", "createdBy", "members", "status"] as const;

/** A15 Projects: name + Slack channel; members are the channel's members. Archived stay listed (muted). */
export function ProjectsPanel({ projects, channels }: { projects: ProjectView[]; channels: SlackChannelOption[] | null }) {
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const { toast, show, dismiss } = useToast();
  const t = useTranslations("admin.projects");
  const tf = useTranslations("admin.projectForm");
  const refreshText = useMemberRefreshText();
  const sorted = [...projects].sort((a, b) => Number(b.isActive) - Number(a.isActive) || a.name.localeCompare(b.name));

  function done({ project, members }: ProjectSaveResult, created: boolean) {
    setEditing(null);
    const saved = created ? tf("created", { name: project.name }) : tf("saved", { name: project.name });
    if (!project.slackChannelId) return show(saved);
    const label = channelLabel(channels, project.slackChannelId);
    if (!members) return show(`${saved} ${t("membersNotRefreshed")}`, { tone: "error" });
    const { text, warn } = refreshText(members, label);
    show(`${saved} ${text}`, warn ? { tone: "error" } : {});
  }

  const form = (project?: ProjectView) => (
    <ProjectForm
      project={project}
      channels={channels}
      taken={takenChannelMap(projects, project?.id)}
      onDone={done}
      onCancel={() => setEditing(null)}
    />
  );

  return (
    <section aria-labelledby="projects-title" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="projects-title" className="text-lg font-semibold">
            {t("title")}
          </h2>
          <p className="text-muted-foreground">{t("helper")}</p>
        </div>
        <Button onClick={() => setEditing("new")} disabled={editing === "new"} className="hit-target">
          <Plus aria-hidden />
          {t("new")}
        </Button>
      </div>
      <div className="overflow-x-auto rounded-lg border bg-card">
        {editing === "new" ? <div className="border-b">{form()}</div> : null}
        {sorted.length === 0 && editing !== "new" ? (
          <p className="p-6 text-muted-foreground">{t("empty")}</p>
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b text-xs font-medium text-muted-foreground">
                {COLUMNS.map((c) => (
                  <th key={c} scope="col" className={c === "name" ? "h-10 px-4 text-left font-medium" : c === "members" ? "px-3 text-right font-medium" : "px-3 text-left font-medium"}>
                    {t(`columns.${c}`)}
                  </th>
                ))}
                <th scope="col" className="px-4 text-right font-medium">
                  <span className="sr-only">{t("columns.actions")}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((p) =>
                editing === p.id ? (
                  <tr key={p.id} className="border-b last:border-b-0">
                    <td colSpan={COLUMNS.length + 1}>{form(p)}</td>
                  </tr>
                ) : (
                  <ProjectRow
                    key={p.id}
                    project={p}
                    channels={channels}
                    onEdit={() => setEditing(p.id)}
                    onToast={(message, tone, retry) => show(message, { tone, onRetry: retry })}
                  />
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
