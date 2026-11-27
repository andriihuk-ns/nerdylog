"use client";

import { useId, useState, useTransition, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import type { OfficeView, ProjectView, SlackChannelOption } from "@/contracts";
import { upsertProjectAction, type ProjectSaveResult } from "@/app/(dashboard)/admin/project-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { FilterSelect } from "@/components/shell/filter-select";
import { ChannelField } from "./channel-field";
import { findChannel } from "./channel-options";
import { useChannelErrorText } from "./use-channel-error-text";

interface Props {
  project?: ProjectView; // omitted → create
  channels: SlackChannelOption[] | null; // null → Slack not configured
  offices: OfficeView[]; // A16 prompt office (timezone + holidays)
  taken: Map<string, string>; // channels linked to other projects
  onDone: (result: ProjectSaveResult, created: boolean) => void;
  onCancel: () => void;
}

/** Project form: name, Slack channel (required on create), active; A16 status prompt time + office. */
export function ProjectForm({ project, channels, offices, taken, onDone, onCancel }: Props) {
  const id = useId();
  const t = useTranslations("admin.projectForm");
  const tc = useTranslations("common");
  const channelErrorText = useChannelErrorText();
  const [name, setName] = useState(project?.name ?? "");
  const [isActive, setActive] = useState(project?.isActive ?? true);
  const [channelId, setChannelId] = useState<string | null>(project?.slackChannelId ?? null);
  const [channelError, setChannelError] = useState<string | null>(null);
  const defaultOffice = offices.find((o) => o.code === "UA")?.id ?? offices[0]?.id ?? null;
  const [promptTime, setPromptTime] = useState(project?.statusPromptTime ?? "10:00");
  const [promptOffice, setPromptOffice] = useState<string | null>(project?.statusPromptOfficeId ?? defaultOffice);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setError(t("nameRequired"));
    if (!project && !channelId) return setChannelError(t("channelRequired"));
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(promptTime)) return setError(t("promptTimeInvalid"));
    setError(null);
    setChannelError(null);
    startTransition(async () => {
      const res = await upsertProjectAction({
        id: project?.id,
        name,
        isActive,
        slackChannelId: channelId,
        statusPromptTime: promptTime,
        statusPromptOfficeId: promptOffice,
      });
      if (res.ok) return onDone(res.data, !project);
      if ("field" in res) setChannelError(channelErrorText(res, findChannel(channels, channelId)?.name));
      else setError(res.message);
    });
  }

  return (
    <form
      onSubmit={submit}
      onKeyDown={(e) => e.key === "Escape" && onCancel()}
      aria-label={project ? t("editLabel", { name: project.name }) : t("newLabel")}
      className="grid gap-4 p-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-start"
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${id}-name`}>{t("name")}</Label>
        <Input id={`${id}-name`} value={name} onChange={(e) => setName(e.target.value)} autoFocus required maxLength={120} className="h-11" />
      </div>
      <ChannelField
        id={`${id}-channel`}
        label={project ? t("channel") : t("channelRequiredLabel")}
        noneLabel={t("noChannel")}
        channels={channels}
        value={channelId}
        taken={taken}
        error={channelError}
        helper={t("channelHelper")}
        onChange={(next) => {
          setChannelId(next);
          setChannelError(null);
        }}
      />
      <label className="hit-target flex items-center gap-2 sm:mt-6">
        <Switch checked={isActive} onCheckedChange={setActive} />
        {t("active")}
      </label>
      <div className="flex flex-wrap items-end gap-3 sm:col-span-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${id}-time`}>{t("promptTime")}</Label>
          <Input
            id={`${id}-time`}
            type="time"
            step={60}
            value={promptTime}
            onChange={(e) => setPromptTime(e.target.value)}
            required
            className="tabular h-11 w-32"
          />
        </div>
        {offices.length > 0 ? (
          <div className="flex flex-col gap-1.5">
            <span aria-hidden className="text-sm font-medium">
              {t("promptOffice")}
            </span>
            <FilterSelect
              label={t("promptOffice")}
              value={promptOffice ?? ""}
              onChange={setPromptOffice}
              options={offices.map((o) => ({ value: o.id, label: `${o.code} · ${o.name}` }))}
              className="h-11 w-48"
            />
          </div>
        ) : null}
        <p className="w-full text-xs text-muted-foreground">{t("promptHelper")}</p>
      </div>
      {error ? (
        <p role="alert" className="text-destructive sm:col-span-3">
          {error}
        </p>
      ) : null}
      <div className="flex flex-col-reverse gap-2 sm:col-span-3 sm:flex-row sm:justify-end">
        <Button type="button" variant="ghost" className="hit-target" onClick={onCancel}>
          {tc("cancel")}
        </Button>
        <Button type="submit" className="hit-target" disabled={pending}>
          {pending ? tc("saving") : project ? tc("save") : t("create")}
        </Button>
      </div>
    </form>
  );
}
