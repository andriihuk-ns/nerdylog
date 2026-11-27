"use client";

import { useMemo, useOptimistic, useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import type { OfficeView, ProjectView, SlackChannelOption } from "@/contracts";
import { deleteProjectAction, type ProjectSaveResult } from "@/app/(dashboard)/admin/project-actions";
import { useToast } from "@/hooks/use-toast";
import { useConfirm } from "@/hooks/use-confirm";
import { Button } from "@/components/ui/button";
import { Toast } from "@/components/ui/toast";
import { SearchInput } from "@/components/shell/search-input";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ProjectForm } from "./project-form";
import { ProjectRow } from "./project-row";
import { channelLabel, takenChannelMap } from "./channel-options";
import { useMemberRefreshText } from "./use-member-refresh-text";
import { TABLE_EDGE_PADDING } from "@/components/shell/table-styles";

const COLUMNS = ["status", "name", "channel", "prompt"] as const;

interface Props {
  projects: ProjectView[];
  channels: SlackChannelOption[] | null;
  offices: OfficeView[];
}

/** Projects: name + Slack channel + status prompt (A16); members are the channel's members. Archived stay listed (muted). */
export function ProjectsPanel({ projects, channels, offices }: Props) {
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [query, setQuery] = useState("");
  const { toast, show, dismiss } = useToast();
  const t = useTranslations("admin.projects");
  const tf = useTranslations("admin.projectForm");
  const tc = useTranslations("common");
  const refreshText = useMemberRefreshText();
  const { confirm, dialog } = useConfirm();
  const [list, removeOptimistic] = useOptimistic(projects, (cur: ProjectView[], id: string) => cur.filter((p) => p.id !== id));
  const [, startRemove] = useTransition();
  const debouncedQuery = useDebouncedValue(query);
  const sorted = useMemo(
    () => [...list].sort((a, b) => Number(b.isActive) - Number(a.isActive) || a.name.localeCompare(b.name)),
    [list],
  );
  const normalizedQuery = debouncedQuery.trim().toLocaleLowerCase();
  const visible = useMemo(
    () => sorted.filter((project) => {
      if (!normalizedQuery) return true;
      const channel = project.slackChannelId ? channelLabel(channels, project.slackChannelId) : "";
      return `${project.name} ${channel}`.toLocaleLowerCase().includes(normalizedQuery);
    }),
    [channels, normalizedQuery, sorted],
  );
  const editingProject = editing && editing !== "new" ? projects.find((project) => project.id === editing) : undefined;

  function done({ project, members }: ProjectSaveResult, created: boolean) {
    setEditing(null);
    const saved = created ? tf("created", { name: project.name }) : tf("saved", { name: project.name });
    if (!project.slackChannelId) return show(saved);
    const label = channelLabel(channels, project.slackChannelId);
    if (!members) return show(`${saved} ${t("membersNotRefreshed")}`, { tone: "error" });
    const { text, warn } = refreshText(members, label);
    show(`${saved} ${text}`, warn ? { tone: "error" } : {});
  }

  async function remove(p: ProjectView) {
    const ok = await confirm({ title: t("confirmDelete", { name: p.name }), description: tc("cantUndo"), confirmLabel: tc("delete") });
    if (!ok) return;
    startRemove(async () => {
      removeOptimistic(p.id);
      const res = await deleteProjectAction(p.id);
      if (res.ok) show(t("deleted", { name: p.name }));
      else show(t("deleteFailed", { name: p.name, reason: res.message }), { tone: "error" });
    });
  }

  const form = (project?: ProjectView) => (
    <ProjectForm
      project={project}
      channels={channels}
      offices={offices}
      taken={takenChannelMap(projects, project?.id)}
      onDone={done}
      onCancel={() => setEditing(null)}
    />
  );

  return (
    <section aria-label={t("title")} className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div role="search" className="w-full sm:max-w-md">
          <SearchInput value={query} onChange={setQuery} label={t("search")} />
        </div>
        <Button onClick={() => setEditing("new")} disabled={editing === "new"} className="hit-target w-full sm:w-auto">
          <Plus aria-hidden />
          {t("new")}
        </Button>
      </div>
      <div className="overflow-x-auto rounded-lg border bg-card">
        {sorted.length === 0 ? (
          <p className="p-6 text-muted-foreground">{t("empty")}</p>
        ) : visible.length === 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-3 p-6 text-muted-foreground">
            <p>{t("noMatch")}</p>
            <Button variant="outline" className="hit-target" onClick={() => setQuery("")}>{t("clearSearch")}</Button>
          </div>
        ) : (
          <table className={`w-full border-collapse ${TABLE_EDGE_PADDING}`}>
            <thead>
              <tr className="border-b text-xs font-medium text-muted-foreground">
                {COLUMNS.map((c) => (
                  <th key={c} scope="col" className={c === "name" ? "h-10 px-4 text-left font-medium" : "px-3 text-left font-medium whitespace-nowrap"}>
                    {t(`columns.${c}`)}
                  </th>
                ))}
                <th scope="col" className="px-4 text-right font-medium">
                  <span className="sr-only">{t("columns.actions")}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {visible.map((p) => (
                <ProjectRow
                  key={p.id}
                  project={p}
                  channels={channels}
                  offices={offices}
                  onEdit={() => setEditing(p.id)}
                  onDelete={() => void remove(p)}
                  onToast={(message, tone, retry) => show(message, { tone, onRetry: retry })}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>
      <Dialog
        open={editing === "new" || Boolean(editingProject)}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
      >
        <DialogContent className="overflow-y-auto p-0">
          <DialogHeader className="px-4 pt-5 sm:px-6">
            <DialogTitle>
              {editing === "new" ? tf("newLabel") : tf("editLabel", { name: editingProject?.name ?? "" })}
            </DialogTitle>
          </DialogHeader>
          {editing === "new" ? form() : editingProject ? form(editingProject) : null}
        </DialogContent>
      </Dialog>
      <Toast toast={toast} onDismiss={dismiss} />
      {dialog}
    </section>
  );
}
